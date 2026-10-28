// Aftersong backend (Render). Phase 0: health and measured status only.
// Qloo gateway routes arrive in Phase 2. No status value is hard-coded: every field
// below is the result of a probe made by this process, with a timestamp.
import { createServer } from "node:http";
import { existsSync } from "node:fs";

if (existsSync("../.env")) process.loadEnvFile("../.env");

const PORT = Number(process.env.PORT || 8787);
const QLOO_HOST = process.env.QLOO_HOST || "https://hackathon.api.qloo.com";
const SECRET = process.env.BACKEND_SHARED_SECRET || "";
const PROBE_TTL_MS = 10 * 60 * 1000;

let qlooProbe = null;

async function probeQloo() {
  const key = process.env.QLOO_API_KEY;
  const at = new Date().toISOString();
  if (!key) return { configured: false, ok: false, at, detail: "QLOO_API_KEY is not set on this service" };
  const started = Date.now();
  try {
    const url = new URL("/search", QLOO_HOST);
    url.searchParams.set("query", "Sam Cooke");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    return { configured: true, ok: res.ok, httpStatus: res.status, latencyMs: Date.now() - started, at, detail: res.ok ? "search answered" : "search returned an error status" };
  } catch (err) {
    return { configured: true, ok: false, latencyMs: Date.now() - started, at, detail: `request failed: ${err.name}` };
  }
}

async function getQlooProbe() {
  if (!qlooProbe || Date.now() - Date.parse(qlooProbe.at) > PROBE_TTL_MS) qlooProbe = await probeQloo();
  return qlooProbe;
}

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/health") return json(res, 200, { service: "aftersong-backend", up: true, at: new Date().toISOString() });
  if (path === "/status") {
    if (SECRET && req.headers["x-shared-secret"] !== SECRET) return json(res, 401, { error: "unauthorised" });
    return json(res, 200, { service: "aftersong-backend", at: new Date().toISOString(), qloo: await getQlooProbe() });
  }
  json(res, 404, { error: "not found" });
}).listen(PORT, () => console.log(`aftersong-backend listening on ${PORT}`));
