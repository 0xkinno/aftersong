// Aftersong backend (Render). Every route except /health needs the shared secret that only the web
// app's server holds, so the Qloo key and the rules stay behind one door.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NeedsConfirmation, type Sabotage } from "./agent/agent.ts";
import { modelFromEnv } from "./agent/model.ts";
import { authenticate } from "./auth.ts";
import { Limiter, limitConfigFromEnv } from "./limits.ts";
import { QlooClient, QlooError } from "./qloo/client.ts";
import { autoConfirm, resolveFavourite } from "./qloo/resolve.ts";
import { HttpError, Service, type Actor } from "./service.ts";
import { measuredStatus } from "./status.ts";
import { storeFromEnv } from "./store/store.ts";
import type { Resident } from "./store/types.ts";
import type { SessionCard } from "./core/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
const env = process.env as Record<string, string | undefined>;

const client = new QlooClient({ key: env.QLOO_API_KEY || undefined, host: env.QLOO_HOST || undefined, dailyCap: Number(env.DAILY_QLOO_CAP || 2000) });
const model = modelFromEnv(env);
const store = storeFromEnv(env, env.STORE_PATH || join(root, "data", "store.json"));
const limiter = new Limiter(limitConfigFromEnv(env));
const sabotage: Sabotage = env.AFTERSONG_SABOTAGE === "model_injects" ? "model_injects" : "none";
const svc = new Service({ store, client, model, limiter, sabotage, samplesPath: join(root, "data", "samples", "residents.json") });
const SECRET = env.BACKEND_SHARED_SECRET || "";
const PORT = Number(env.PORT || 8787);

type Ctx = { req: IncomingMessage; res: ServerResponse; params: string[]; query: URLSearchParams; body: any; ip: string };
type Handler = (c: Ctx) => Promise<unknown>;
const routes: Array<{ method: string; re: RegExp; h: Handler; stream?: boolean }> = [];
const on = (method: string, path: string, h: Handler, stream = false) => routes.push({ method, re: new RegExp(`^${path.replace(/:[a-z]+/g, "([^/]+)")}$`), h, stream });

function send(res: ServerResponse, code: number, body: unknown, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : (body as Buffer));
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 65536) throw new HttpError(413, "Request too large.");
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Body is not valid JSON.");
  }
}

async function carer(c: Ctx): Promise<Actor> {
  const a = await authenticate(env, c.req.headers);
  if (!a.ok) throw new HttpError(a.status, a.message);
  return { role: "carer", userId: a.userId, homeId: await svc.ensureHome(a.userId) };
}

async function streamCard(c: Ctx, run: (emit: (e: unknown) => void) => Promise<{ card: SessionCard; [k: string]: unknown }>) {
  c.res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" });
  const emit = (e: unknown) => c.res.write(JSON.stringify(e) + "\n");
  try {
    const out = await run(emit);
    emit({ type: "card", card: out.card, modelNote: out.modelNote ?? null });
  } catch (e) {
    emit({ type: "error", ...describe(e) });
  }
  c.res.end();
}

function describe(e: unknown): { status: number; error: string; code?: string } {
  if (e instanceof HttpError) return { status: e.status, error: e.message };
  if (e instanceof NeedsConfirmation) return { status: 409, error: e.message, code: "NEEDS_CONFIRMATION" };
  if (e instanceof QlooError) {
    const plain: Record<string, string> = {
      QLOO_NOT_CONFIGURED: "Qloo is not connected on this server yet, so nothing can be built.",
      QLOO_AUTH: "Qloo refused the key on this server.",
      QLOO_RATE_LIMIT: "Qloo asked us to slow down. Try again in a minute.",
      QLOO_UPSTREAM: "Qloo had a server problem.",
      QLOO_CONNECT: "Qloo could not be reached.",
      QLOO_TIMEOUT: "Qloo took too long to answer.",
      QLOO_CONTRACT: "Qloo returned something unexpected, or a request was blocked before sending.",
      QLOO_DAILY_CAP: "The daily Qloo call cap has been reached.",
    };
    return { status: e.code === "QLOO_RATE_LIMIT" ? 429 : 502, error: plain[e.code] ?? "Qloo failed.", code: e.code };
  }
  return { status: 500, error: "Something went wrong on the server." };
}

// ---------- public ----------
on("GET", "/health", async () => ({ service: "aftersong-backend", up: true, at: new Date().toISOString() }));
on("GET", "/status", async (c) => measuredStatus({ client, model, store, limiter, refresh: c.query.get("refresh") === "1" && c.req.headers["x-admin"] === SECRET }));
on("GET", "/stats", async () => {
  const facts = existsSync(join(root, "docs", "FACTS.json")) ? JSON.parse(readFileSync(join(root, "docs", "FACTS.json"), "utf8")) : null;
  const usage = await store.list<{ kind: string; liveQlooCalls: number; ms: number; inputTokens: number; outputTokens: number; at: string }>("usage");
  const cards = usage.filter((u) => u.kind === "card");
  const avg = (f: (u: (typeof cards)[number]) => number) => (cards.length ? Math.round((cards.reduce((a, u) => a + f(u), 0) / cards.length) * 10) / 10 : null);
  return { at: new Date().toISOString(), facts, live: { cardsBuilt: cards.length, avgLiveQlooCallsPerCard: avg((u) => u.liveQlooCalls), avgBuildMs: avg((u) => u.ms), avgTokensPerCard: avg((u) => u.inputTokens + u.outputTokens) } };
});
on("GET", "/trace", async () => {
  const sampleIds = new Set((await svc.ensureSamples().catch(() => [])).map((r) => r.id));
  const cards = (await store.list<SessionCard>("cards")).filter((c) => sampleIds.has(c.residentId)).slice(-10).reverse();
  return { at: new Date().toISOString(), cards: cards.map((c) => ({ id: c.id, createdAt: c.createdAt, status: c.status, items: c.items.length, rejected: c.rejections.length, model: c.model, trail: c.trail, calls: c.calls })) };
});

on("GET", "/sample/residents", async () => ({ sample: true, residents: (await svc.ensureSamples()).map((r) => ({ id: r.id, firstName: r.firstName, birthYear: r.birthYear, hometown: r.hometown, careCity: r.careCity, favourites: r.favourites.map((f) => ({ text: f.text, confirmed: f.confirmed, name: f.name })) })) }));

async function sampleCard(c: Ctx, id: string, emit?: (e: unknown) => void) {
  await svc.ensureSamples();
  const r = await store.get<Resident>("residents", id);
  if (!r || !r.isSample) throw new HttpError(404, "No such sample resident.");
  const cached = (await store.list<SessionCard>("cards", { residentId: id })).pop();
  if (cached && c.body?.rebuild !== true) return { card: cached, modelNote: null, cached: true };
  const t = limiter.take(c.ip);
  if (!t.ok) throw new HttpError(429, t.reason);
  const out = await svc.buildCard(id, { actor: "sample", onEvent: emit ? (e) => emit({ type: "trail", ...e }) : undefined });
  return { ...out, cached: false };
}
on("POST", "/sample/residents/:id/card", async (c) => streamCard(c, async (emit) => sampleCard(c, c.params[0]!, emit)), true);
on("GET", "/sample/residents/:id/card", async (c) => {
  await svc.ensureSamples();
  const card = (await store.list<SessionCard>("cards", { residentId: c.params[0]! })).pop();
  return card ? { card, cached: true } : { card: null, cached: false };
});
// Sample session taps are checked and discarded, so the phone's offline queue can be shown without storing anything.
on("POST", "/sample/taps", async (c) => ({ ok: true, saved: false, entityId: String(c.body.entityId ?? "").slice(0, 64) }));
on("GET", "/sample/cards/:id/export", async (c) => svc.exportCard("sample", c.params[0]!));
on("POST", "/sample/residents/:id/compare", async (c) => {
  const t = limiter.take(c.ip);
  if (!t.ok) throw new HttpError(429, t.reason);
  return svc.compare(c.params[0]!, "sample");
});
on("POST", "/sample/group", async (c) => {
  const t = limiter.take(c.ip);
  if (!t.ok) throw new HttpError(429, t.reason);
  await svc.ensureSamples();
  const out = await svc.groupWithAgent("sample", Array.isArray(c.body.residentIds) ? c.body.residentIds : []);
  return { ...out.result, trail: out.trail, modelNote: out.modelNote };
});
on("POST", "/sample/hard-case", async (c) => {
  const t = limiter.take(c.ip);
  if (!t.ok) throw new HttpError(429, t.reason);
  const text = "Zxqv Unfindable Nothing 91";
  const res = await resolveFavourite(client, text);
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const exact = res.matches.filter((m) => norm(m.name) === norm(text)).length;
  return {
    birthYear: 1925,
    favourite: text,
    status: res.status,
    matches: res.matches.length,
    message: exact === 0 ? `Qloo has no entity called "${text}"${res.matches.length ? `. It returned ${res.matches.length} near names, and none is used until a carer confirms one` : ""}. With no confirmed favourite, Aftersong does not build a card and does not guess.` : "Qloo has an exact match; the carer would be asked to confirm which one.",
  };
});
on("POST", "/try", async (c) => {
  const b = c.body;
  const texts: string[] = Array.isArray(b.favourites) ? b.favourites.slice(0, 3).map(String) : [];
  const bad = (s: string) => !s.trim() || s.length > 80 || /[@<>]/.test(s) || /\d{6,}/.test(s);
  if (texts.length === 0 || texts.some(bad) || bad(String(b.hometown ?? "")) || bad(String(b.careCity ?? "")) || !Number.isInteger(b.birthYear)) throw new HttpError(400, "Give a birth year, a home city, a hometown and up to three short favourites.");
  const t = limiter.take(c.ip);
  if (!t.ok) throw new HttpError(429, t.reason);
  const favourites: Resident["favourites"] = [];
  for (const text of texts) {
    const m = await autoConfirm(client, text);
    favourites.push(m ? { text, kind: m.kind, id: m.id, name: m.name, type: m.type, confirmed: true } : { text, kind: "unresolved" as const, id: null, name: null, type: null, confirmed: false, reason: "Qloo has no exact match for it" });
  }
  const now = new Date().toISOString();
  const resident: Resident = { id: "try", homeId: "try", firstName: "Guest", birthYear: b.birthYear, careCity: String(b.careCity), hometown: String(b.hometown), favourites, offsets: { from: 10, to: 30 }, consent: true, consentRecord: null, intakeBy: "carer", familySubmittedAt: null, isSample: false, createdAt: now, updatedAt: now };
  return streamCard(c, async (emit) => ({ ...(await svc.buildCard("try", { actor: "public", resident, persist: false, onEvent: (e) => emit({ type: "trail", ...e }) })), favourites }));
}, true);

// ---------- carer ----------
on("GET", "/residents", async (c) => ({ residents: await svc.listResidents(((await carer(c)) as Extract<Actor, { role: "carer" }>).homeId) }));
on("POST", "/residents", async (c) => {
  const a = (await carer(c)) as Extract<Actor, { role: "carer" }>;
  const b = c.body;
  return svc.createResident(a.homeId, { firstName: String(b.firstName ?? ""), birthYear: Number(b.birthYear), careCity: String(b.careCity ?? ""), hometown: String(b.hometown ?? ""), favouriteTexts: Array.isArray(b.favourites) ? b.favourites.map(String) : [], consent: b.consent === true, consentBy: b.consentBy === "resident" ? "resident" : "family", by: "carer" });
});
on("GET", "/residents/:id", async (c) => svc.getResident(await carer(c), c.params[0]!));
on("PUT", "/residents/:id/intake", async (c) => svc.saveIntake(await carer(c), c.params[0]!, { birthYear: c.body.birthYear, hometown: c.body.hometown, favouriteTexts: c.body.favourites }));
on("POST", "/residents/:id/resolve", async (c) => ({ items: await svc.resolveForCarer(await carer(c), c.params[0]!) }));
on("POST", "/residents/:id/confirm", async (c) => svc.confirm(await carer(c), c.params[0]!, String(c.body.text), c.body.pick ?? null));
on("POST", "/residents/:id/cards", async (c) => {
  const a = await carer(c);
  return streamCard(c, async (emit) => svc.buildCard(c.params[0]!, { actor: a, widenBy: Number(c.body.widenBy ?? 0), onEvent: (e) => emit({ type: "trail", ...e }) }));
}, true);
on("GET", "/residents/:id/cards", async (c) => ({ cards: await svc.listCards(await carer(c), c.params[0]!) }));
on("GET", "/residents/:id/timeline", async (c) => svc.timeline(await carer(c), c.params[0]!));
on("POST", "/residents/:id/family-link", async (c) => ({ token: await svc.createFamilyLink(await carer(c), c.params[0]!) }));
on("POST", "/residents/:id/compare", async (c) => svc.compare(c.params[0]!, await carer(c)));
on("GET", "/residents/:id/lifestory", async (c) => {
  const pdf = await svc.lifeStory(await carer(c), c.params[0]!);
  return { __raw: pdf, type: "application/pdf" };
});
on("DELETE", "/residents/:id/observations/:obs", async (c) => {
  await svc.deleteObservation(await carer(c), c.params[0]!, c.params[1]!);
  return { ok: true };
});
on("GET", "/cards/:id", async (c) => svc.getCard(await carer(c), c.params[0]!));
on("GET", "/cards/:id/export", async (c) => svc.exportCard(await carer(c), c.params[0]!));
on("POST", "/cards/:id/observations", async (c) => svc.logObservation(await carer(c), c.params[0]!, String(c.body.entityId), String(c.body.value), c.body.note ?? null));
on("GET", "/cards/:id/session", async (c) => ({ session: await svc.getSession(await carer(c), c.params[0]!) }));
on("PUT", "/cards/:id/session", async (c) => svc.saveSession(await carer(c), c.params[0]!, { currentIndex: Number(c.body.currentIndex ?? 0), finished: c.body.finished === true }));
on("POST", "/group", async (c) => {
  const out = await svc.groupWithAgent(await carer(c), Array.isArray(c.body.residentIds) ? c.body.residentIds : []);
  return { ...out.result, trail: out.trail, modelNote: out.modelNote };
});

// ---------- family ----------
on("GET", "/family/:token", async (c) => svc.familyView(await svc.familyActor(c.params[0]!)));
on("PUT", "/family/:token/intake", async (c) => {
  const a = await svc.familyActor(c.params[0]!);
  if (a.role !== "family") throw new HttpError(403, "Family only.");
  return svc.saveIntake(a, a.residentId, { birthYear: c.body.birthYear, hometown: c.body.hometown, favouriteTexts: c.body.favourites, consent: c.body.consent === true });
});
on("DELETE", "/family/:token/memory/:obs", async (c) => {
  const a = await svc.familyActor(c.params[0]!);
  if (a.role !== "family") throw new HttpError(403, "Family only.");
  await svc.deleteObservation(a, a.residentId, c.params[1]!);
  return { ok: true };
});
on("GET", "/family/:token/lifestory", async (c) => {
  const a = await svc.familyActor(c.params[0]!);
  if (a.role !== "family") throw new HttpError(403, "Family only.");
  return { __raw: await svc.lifeStory(a, a.residentId), type: "application/pdf" };
});

// ---------- scheduled ----------
on("POST", "/internal/digests", async () => svc.runDigests("scheduler"));

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
  try {
    if (!route) throw new HttpError(404, "Not found.");
    if (url.pathname !== "/health" && (!SECRET || req.headers["x-shared-secret"] !== SECRET)) throw new HttpError(401, "Unauthorised.");
    if (limiter.cfg.kill && url.pathname.startsWith("/try")) throw new HttpError(503, "Live building is switched off for now.");
    const params = (route.re.exec(url.pathname) ?? []).slice(1).map(decodeURIComponent);
    const ip = String(req.headers["x-visitor-ip"] ?? req.socket.remoteAddress ?? "unknown");
    const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
    const out: any = await route.h({ req, res, params, query: url.searchParams, body, ip });
    if (route.stream) return;
    if (out && out.__raw) return send(res, 200, out.__raw, out.type);
    send(res, 200, out);
  } catch (e) {
    const d = describe(e);
    if (!res.headersSent) send(res, d.status, { error: d.error, code: d.code });
    else res.end();
    if (d.status === 500) console.error(e);
  }
});

// A weekly digest that nobody asks for: Monday 07:00 UTC. The create-only claim in runDigests makes
// a restart or a second instance harmless.
setInterval(async () => {
  const n = new Date();
  if (n.getUTCDay() === 1 && n.getUTCHours() === 7 && n.getUTCMinutes() < 5) await svc.runDigests("scheduler").catch((e) => console.error("digest run failed", e));
}, 60000).unref();

server.listen(PORT, () => console.log(`aftersong-backend listening on ${PORT} (storage: ${store.kind}, qloo: ${client.configured ? "key set" : "no key"}, model: ${model ? `${model.provider}/${model.id}` : "none"})`));
