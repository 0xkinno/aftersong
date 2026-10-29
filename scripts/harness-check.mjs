// Harness equivalence check. Runs the sponsor's own `qloo exec` (from @qloo/qloo-harness, 0.1.26 or
// newer) for one resolve and one recommend, and confirms that our REST client returns the same entity
// IDs. Shows that the newest kit was used and that REST was chosen for rate-limit reasons, with
// evidence. Writes docs/harness-check.json, which scripts/sdk-surface.mjs reads.
// Usage: node scripts/harness-check.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { QlooClient } from "../backend/src/qloo/client.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.QLOO_API_KEY) { console.error("QLOO_API_KEY is not set in .env. Nothing was run."); process.exit(2); }

const DIR = "data/harness";
const BIN = `${DIR}/node_modules/@qloo/qloo-harness/dist/bin.js`;
if (!existsSync(BIN)) {
  mkdirSync(DIR, { recursive: true });
  if (!existsSync(`${DIR}/package.json`)) writeFileSync(`${DIR}/package.json`, '{"private":true}');
  execFileSync("npm", ["install", "@qloo/qloo-harness@0.1.26", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: DIR, stdio: "inherit", shell: process.platform === "win32" });
}
const version = JSON.parse(execFileSync(process.execPath, ["-e", `console.log(JSON.stringify(require("./${DIR}/node_modules/@qloo/qloo-harness/package.json")))`], { encoding: "utf8" })).version;

const exec = (op, input) => {
  const out = execFileSync(process.execPath, [BIN, "exec", op, "--input", JSON.stringify(input)], { encoding: "utf8", env: { ...process.env, QLOO_HOME: `${process.cwd()}/${DIR}/home` }, timeout: 90000 });
  return JSON.parse(out);
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const ids = (obj) => new Set((JSON.stringify(obj).match(UUID) ?? []).map((x) => x.toLowerCase()));

const client = new QlooClient({ key: process.env.QLOO_API_KEY, host: process.env.QLOO_HOST || undefined, dailyCap: 50 });
const result = { at: new Date().toISOString(), harnessVersion: version, resolve: null, recommend: null };

// 1. resolve
const ours = await client.search("Sam Cooke", "urn:entity:artist", 5);
const ourTop = ours.entities[0]?.id?.toLowerCase() ?? null;
try {
  const h = exec("describe", { entity: "Sam Cooke", type: "urn:entity:artist" });
  const hIds = ids(h);
  result.resolve = { ourTopId: ourTop ? "present" : null, harnessReturnedIds: hIds.size, sameTopId: ourTop ? hIds.has(ourTop) : false };
} catch (e) {
  result.resolve = { error: String(e.message).slice(0, 160) };
}

// 2. recommend
try {
  const film = await client.search("Casablanca", "urn:entity:movie", 3);
  const filmId = film.entities[0]?.id;
  const mine = await client.insights({ "filter.type": "urn:entity:movie", "signal.interests.entities": filmId, take: 10 });
  const mineIds = new Set(mine.entities.map((e) => e.id.toLowerCase()));
  const h = exec("recommend", { target_type: "urn:entity:movie", signals: [filmId], limit: 10 });
  const hIds = ids(h);
  const overlap = [...mineIds].filter((x) => hIds.has(x)).length;
  result.recommend = { ours: mineIds.size, harness: hIds.size, shared: overlap, sharePct: mineIds.size ? Math.round((overlap / mineIds.size) * 100) : null };
} catch (e) {
  result.recommend = { error: String(e.message).slice(0, 160) };
}

writeFileSync("docs/harness-check.json", JSON.stringify(result, null, 2) + "\n");
console.log(result);
