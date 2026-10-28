// Qloo REST client. Discipline learned from the event's rate limit: 250 ms between live calls,
// no automatic retry on 429, in-flight de-duplication, a 24 hour private cache, a daily cap,
// typed errors. Every live and cached call is recorded so a card can show its own receipts.
import { AsyncLocalStorage } from "node:async_hooks";
import { assertSafeParams, GuardError, type Params } from "./guard.ts";
import { extractEntities, extractTags, type QlooEntity, type Tag } from "./entity.ts";

export type QlooErrorCode =
  | "QLOO_NOT_CONFIGURED"
  | "QLOO_AUTH"
  | "QLOO_RATE_LIMIT"
  | "QLOO_UPSTREAM"
  | "QLOO_CONNECT"
  | "QLOO_TIMEOUT"
  | "QLOO_CONTRACT"
  | "QLOO_DAILY_CAP";

export class QlooError extends Error {
  code: QlooErrorCode;
  status: number | null;
  constructor(code: QlooErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "QlooError";
    this.code = code;
    this.status = status;
  }
}

export interface CallRecord {
  id: string;
  path: string;
  params: Params;
  status: number | null;
  cached: boolean;
  ms: number;
  at: string;
  resultCount: number | null;
}

export interface HttpResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}
export type Transport = (url: URL, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<HttpResponse>;

export interface ClientOptions {
  key: string | undefined;
  host?: string;
  transport?: Transport;
  spacingMs?: number;
  cacheTtlMs?: number;
  dailyCap?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface Trace {
  calls: CallRecord[];
  raw: Map<string, unknown>;
}
const traceStore = new AsyncLocalStorage<Trace>();

const stable = (p: Params) =>
  Object.entries(p)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

export class QlooClient {
  private key: string | undefined;
  private host: string;
  private transport: Transport;
  private spacingMs: number;
  private cacheTtlMs: number;
  private dailyCap: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private nextAt = 0;
  private cache = new Map<string, { at: number; body: unknown; count: number | null }>();
  private inflight = new Map<string, Promise<{ body: unknown; count: number | null; cached: boolean; status: number | null }>>();
  private day = "";
  private dayCount = 0;
  private seq = 0;
  lastRateHeaders: Record<string, string> = {};

  constructor(o: ClientOptions) {
    this.key = o.key;
    this.host = o.host ?? "https://hackathon.api.qloo.com";
    this.transport = o.transport ?? ((url, init) => fetch(url, { method: "GET", redirect: "error", ...init }) as Promise<HttpResponse>);
    this.spacingMs = o.spacingMs ?? 250;
    this.cacheTtlMs = o.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    this.dailyCap = o.dailyCap ?? 2000;
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get configured(): boolean {
    return Boolean(this.key);
  }

  /** Runs fn and returns every call made inside it, live or cached. */
  async trace<T>(fn: () => Promise<T>): Promise<{ value: T; calls: CallRecord[]; raw: Map<string, unknown> }> {
    const t: Trace = { calls: [], raw: new Map() };
    const value = await traceStore.run(t, fn);
    return { value, calls: t.calls, raw: t.raw };
  }

  private liveToday(): number {
    const d = new Date(this.now()).toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.dayCount = 0;
    }
    return this.dayCount;
  }

  liveCallsToday(): number {
    return this.liveToday();
  }

  private async live(path: string, params: Params): Promise<{ body: unknown; status: number }> {
    if (!this.key) throw new QlooError("QLOO_NOT_CONFIGURED", "QLOO_API_KEY is not set on this service");
    if (this.liveToday() >= this.dailyCap) throw new QlooError("QLOO_DAILY_CAP", "Daily Qloo call cap reached");
    const at = Math.max(this.now(), this.nextAt);
    this.nextAt = at + this.spacingMs;
    const wait = at - this.now();
    if (wait > 0) await this.sleep(wait);
    this.dayCount += 1;
    const url = new URL(path, this.host);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    let res: HttpResponse;
    try {
      res = await this.transport(url, {
        headers: { "X-Api-Key": this.key, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      const name = (err as Error).name;
      throw new QlooError(name === "TimeoutError" || name === "AbortError" ? "QLOO_TIMEOUT" : "QLOO_CONNECT", `Qloo request failed: ${name}`);
    }
    for (const h of ["x-ratelimit-remaining-month", "x-ratelimit-remaining", "retry-after"]) {
      const v = res.headers.get(h);
      if (v) this.lastRateHeaders[h] = v;
    }
    if (res.status === 401 || res.status === 403) throw new QlooError("QLOO_AUTH", `Qloo refused the request (${res.status})`, res.status);
    if (res.status === 429) throw new QlooError("QLOO_RATE_LIMIT", "Qloo rate limit reached", 429);
    if (res.status >= 500) throw new QlooError("QLOO_UPSTREAM", `Qloo server error (${res.status})`, res.status);
    if (res.status < 200 || res.status >= 300) throw new QlooError("QLOO_CONTRACT", `Qloo returned ${res.status}`, res.status);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new QlooError("QLOO_CONTRACT", "Qloo returned a body that is not JSON", res.status);
    }
    return { body, status: res.status };
  }

  async get(path: string, params: Params): Promise<{ body: unknown; callId: string }> {
    try {
      assertSafeParams(path, params);
    } catch (e) {
      if (e instanceof GuardError) throw new QlooError("QLOO_CONTRACT", `Blocked before sending: ${e.message}`);
      throw e;
    }
    const k = `${path}?${stable(params)}`;
    const started = this.now();
    const callId = `q${++this.seq}`;
    const t = traceStore.getStore();
    const record = (status: number | null, cached: boolean, count: number | null) =>
      t?.calls.push({ id: callId, path, params, status, cached, ms: this.now() - started, at: new Date(started).toISOString(), resultCount: count });

    const hit = this.cache.get(k);
    if (hit && this.now() - hit.at < this.cacheTtlMs) {
      record(200, true, hit.count);
      t?.raw.set(callId, hit.body);
      return { body: hit.body, callId };
    }
    let p = this.inflight.get(k);
    if (!p) {
      p = (async () => {
        const { body, status } = await this.live(path, params);
        const count = extractEntities(body).length || extractTags(body).length || null;
        this.cache.set(k, { at: this.now(), body, count });
        return { body, count, cached: false, status };
      })().finally(() => this.inflight.delete(k));
      this.inflight.set(k, p);
    }
    try {
      const r = await p;
      record(r.status, r.cached, r.count);
      t?.raw.set(callId, r.body);
      return { body: r.body, callId };
    } catch (e) {
      record(e instanceof QlooError ? e.status : null, false, null);
      throw e;
    }
  }

  async search(query: string, type?: string, take = 5): Promise<{ entities: QlooEntity[]; callId: string }> {
    const { body, callId } = await this.get("/search", { query, types: type, take });
    return { entities: extractEntities(body), callId };
  }

  async tags(query: string, take = 10): Promise<{ tags: Tag[]; callId: string }> {
    const { body, callId } = await this.get("/v2/tags", { "filter.query": query, "feature.semantic_search": true, take });
    return { tags: extractTags(body), callId };
  }

  async entities(ids: string[]): Promise<{ entities: QlooEntity[]; callId: string | null }> {
    if (ids.length === 0) return { entities: [], callId: null };
    const { body, callId } = await this.get("/entities", { entity_ids: ids.join(",") });
    return { entities: extractEntities(body), callId };
  }

  async insights(params: Params): Promise<{ entities: QlooEntity[]; callId: string }> {
    const { body, callId } = await this.get("/v2/insights", params);
    return { entities: extractEntities(body), callId };
  }
}
