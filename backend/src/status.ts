// Measured status. Every field is the result of a probe made by this process, with its time.
// Probes are cached for ten minutes so a refresh loop cannot spend the quota.
import type { Model } from "./agent/model.ts";
import type { QlooClient } from "./qloo/client.ts";
import type { Store } from "./store/store.ts";

const TTL = 10 * 60 * 1000;
let qloo: { at: number; value: Awaited<ReturnType<QlooClient["probe"]>> } | null = null;
let model: { at: number; value: ModelProbe } | null = null;

export interface ModelProbe {
  configured: boolean;
  ok: boolean;
  provider: string | null;
  id: string | null;
  ms: number;
  at: string;
  detail: string;
}

async function probeModel(m: Model | null): Promise<ModelProbe> {
  const at = new Date().toISOString();
  if (!m) return { configured: false, ok: false, provider: null, id: null, ms: 0, at, detail: "No model key is set on this service" };
  const t0 = Date.now();
  try {
    const r = await m.complete("Reply with the single word ok.", [{ role: "user", text: "ok?" }], [], AbortSignal.timeout(20000));
    return { configured: true, ok: r.text.length > 0, provider: m.provider, id: m.id, ms: Date.now() - t0, at, detail: r.text.length > 0 ? "model answered" : "empty answer" };
  } catch (e) {
    return { configured: true, ok: false, provider: m.provider, id: m.id, ms: Date.now() - t0, at, detail: (e as Error).message.slice(0, 80) };
  }
}

export async function measuredStatus(d: { client: QlooClient; model: Model | null; store: Store; limiter: { snapshot(): unknown }; refresh?: boolean }) {
  const now = Date.now();
  if (d.refresh || !qloo || now - qloo.at > TTL) qloo = { at: now, value: await d.client.probe() };
  if (d.refresh || !model || now - model.at > TTL) model = { at: now, value: await probeModel(d.model) };
  return {
    service: "aftersong-backend",
    at: new Date().toISOString(),
    qloo: { ...qloo.value, liveCallsToday: d.client.liveCallsToday(), rateHeaders: d.client.lastRateHeaders },
    model: model.value,
    storage: { kind: d.store.kind },
    limits: d.limiter.snapshot(),
    node: process.version,
  };
}
