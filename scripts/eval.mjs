// Eval harness. For each intake form: resolve favourites (exact name match only, the rest stay
// unconfirmed), build an Aftersong card, run the plain AI list through the same rules, and record
// counts. The full run (with Qloo-derived content) goes to data/runs/ and stays private. Only
// aggregates and hashed ids go to docs/eval-summary.json.
// Usage: node scripts/eval.mjs [--limit N] [--set curated|wild]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { runCardAgent, NeedsConfirmation } from "../backend/src/agent/agent.ts";
import { modelFromEnv } from "../backend/src/agent/model.ts";
import { runPlainAi } from "../backend/src/agent/plain.ts";
import { QlooClient } from "../backend/src/qloo/client.ts";
import { resolveFavourite } from "../backend/src/qloo/resolve.ts";
import { bumpWindow } from "../backend/src/core/window.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const limit = Number(arg("--limit") ?? 999);
const only = arg("--set");

const client = new QlooClient({ key: process.env.QLOO_API_KEY || undefined, host: process.env.QLOO_HOST || undefined, dailyCap: Number(process.env.DAILY_QLOO_CAP || 3000) });
const model = modelFromEnv(process.env);
if (!client.configured) { console.error("QLOO_API_KEY is not set. Nothing was run."); process.exit(2); }
if (!model) console.warn("No model configured: cards use template openers and the plain AI comparison is skipped.");

const forms = [];
if (!only || only === "curated") forms.push(...JSON.parse(readFileSync("data/eval/curated.json", "utf8")));
if ((!only || only === "wild") && existsSync("data/wild")) {
  for (const f of readdirSync("data/wild").filter((f) => f.endsWith(".json") && !f.includes("template"))) {
    for (const w of JSON.parse(readFileSync(`data/wild/${f}`, "utf8"))) if (w.consent === true) forms.push({ ...w, set: "wild" });
  }
}
const hash = (id) => createHash("sha256").update(id).digest("hex").slice(0, 10);
const rows = [];
const full = [];

for (const f of forms.slice(0, limit)) {
  const t0 = Date.now();
  try {
    const favourites = [];
    for (const text of f.favourites) {
      const res = await resolveFavourite(client, text);
      const m = res.status === "one" ? res.matches[0] : null;
      favourites.push(m ? { text, kind: m.kind, id: m.id, name: m.name, type: m.type, confirmed: true } : { text, kind: "unresolved", id: null, name: null, type: null, confirmed: false });
    }
    const resident = { id: f.id, homeId: "eval", firstName: f.firstName, birthYear: f.birthYear, careCity: f.careCity, hometown: f.hometown, favourites, offsets: { from: 10, to: 30 }, consent: true, intakeBy: "carer", familySubmittedAt: null, isSample: false, createdAt: "", updatedAt: "" };
    let r;
    try {
      r = await runCardAgent({ client, model }, { resident, observations: [], cardId: `eval-${f.id}` });
    } catch (e) {
      if (e instanceof NeedsConfirmation) { rows.push({ id: f.id, set: f.set, status: "error", reason: "no favourite resolved to a single exact match", itemHashes: [] }); console.log(`${f.id}: no confirmed favourite`); continue; }
      throw e;
    }
    const card = r.card;
    let plain = null;
    if (model) {
      const p = await runPlainAi({ client, model }, resident, bumpWindow(f.birthYear, resident.offsets));
      plain = p.summary;
      full.push({ id: f.id, plainRows: p.rows });
    }
    rows.push({
      id: f.id, set: f.set, status: card.status === "ok" ? "built" : "thin", reason: card.status === "ok" ? null : "fewer than six items survived the rules",
      items: card.items.length, personal: card.items.filter((i) => i.label === "personal").length, widelyKnown: card.items.filter((i) => i.label === "widely_known").length,
      rejected: card.rejections.length, itemHashes: card.items.map((i) => hash(i.entityId)),
      liveCalls: card.calls.filter((c) => !c.cached).length, ms: Date.now() - t0, tokens: r.usage.inputTokens + r.usage.outputTokens, plain,
    });
    full.push({ id: f.id, card, evidence: r.evidence });
    console.log(`${f.id}: ${card.status}, ${card.items.length} items${plain ? `, plain AI passing ${plain.passing}/${plain.total}` : ""}`);
  } catch (e) {
    rows.push({ id: f.id, set: f.set, status: "error", reason: `${e.code ?? e.name}`, itemHashes: [] });
    console.log(`${f.id}: error ${e.code ?? e.name}`);
    if (e.code === "QLOO_DAILY_CAP" || e.code === "QLOO_AUTH") break;
  }
}

const runAt = new Date().toISOString();
mkdirSync("data/runs", { recursive: true });
writeFileSync(`data/runs/eval-${runAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({ runAt, full }, null, 1));
writeFileSync("docs/eval-summary.json", JSON.stringify({ runAt, model: model ? { provider: model.provider, id: model.id } : null, rows }, null, 1));
console.log(`Wrote docs/eval-summary.json (${rows.length} forms). Now run: node scripts/facts.mjs`);
