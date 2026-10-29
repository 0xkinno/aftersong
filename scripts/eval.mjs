// Pre-registered eval. For each intake form: resolve favourites (exact name match only), build an
// Aftersong card, then run the plain AI list THREE times (same model, same prompt, default temperature)
// through the same rules. The full run (with Qloo-derived content) goes to data/runs/ and stays
// private. Only aggregates and hashed ids go to docs/eval-summary.json.
// The script refuses to run unless the curated forms and the wild forms hash match what was committed.
// Usage: node scripts/eval.mjs [--limit N] [--set curated|wild] [--allow-uncommitted]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NeedsConfirmation, runCardAgent } from "../backend/src/agent/agent.ts";
import { modelFromEnv } from "../backend/src/agent/model.ts";
import { runPlainAi } from "../backend/src/agent/plain.ts";
import { QlooClient } from "../backend/src/qloo/client.ts";
import { autoConfirm } from "../backend/src/qloo/resolve.ts";
import { bumpWindow } from "../backend/src/core/window.ts";
import { FORMS, WILD, verifyPrereg } from "./lib/prereg.mjs";

if (existsSync(".env")) process.loadEnvFile(".env");
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const limit = Number(arg("--limit") ?? 999);
const only = arg("--set");
const RUNS = 3;

const pre = verifyPrereg({ requireCommitted: !process.argv.includes("--allow-uncommitted") });
if (!pre.ok) {
  console.error(`Refusing to run. The eval inputs are not pre-registered:\n- ${pre.problems.join("\n- ")}`);
  process.exit(3);
}

const client = new QlooClient({ key: process.env.QLOO_API_KEY || undefined, host: process.env.QLOO_HOST || undefined, dailyCap: Number(process.env.DAILY_QLOO_CAP || 3000) });
const model = modelFromEnv(process.env);
if (!client.configured) { console.error("QLOO_API_KEY is not set. Nothing was run."); process.exit(2); }
if (!model) console.warn("No model configured: cards use template openers and the plain AI arm is skipped.");

const forms = [];
if (!only || only === "curated") forms.push(...JSON.parse(readFileSync(FORMS, "utf8")));
if ((!only || only === "wild") && existsSync(WILD)) for (const w of JSON.parse(readFileSync(WILD, "utf8"))) if (w.consent === true) forms.push({ ...w, set: "wild" });

const hash = (id) => createHash("sha256").update(String(id)).digest("hex").slice(0, 10);
const rows = [];
const full = [];

for (const f of forms.slice(0, limit)) {
  const t0 = Date.now();
  try {
    const favourites = [];
    for (const text of f.favourites) {
      const m = await autoConfirm(client, text);
      favourites.push(m ? { text, kind: m.kind, id: m.id, name: m.name, type: m.type, confirmed: true } : { text, kind: "unresolved", id: null, name: null, type: null, confirmed: false });
    }
    const resident = { id: f.id, homeId: "eval", firstName: f.firstName, birthYear: f.birthYear, careCity: f.careCity, hometown: f.hometown, favourites, offsets: { from: 10, to: 30 }, consent: true, consentRecord: null, intakeBy: "carer", familySubmittedAt: null, isSample: false, createdAt: "", updatedAt: "" };
    let r;
    try {
      r = await runCardAgent({ client, model }, { resident, observations: [], cardId: `eval-${f.id}` });
    } catch (e) {
      if (e instanceof NeedsConfirmation) { rows.push({ id: f.id, set: f.set, status: "error", reason: "no favourite resolved to a single exact match", itemHashes: [] }); console.log(`${f.id}: no confirmed favourite`); continue; }
      throw e;
    }
    const card = r.card;
    const plainRuns = [];
    if (model) {
      for (let k = 0; k < RUNS; k++) {
        const p = await runPlainAi({ client, model }, resident, bumpWindow(f.birthYear, resident.offsets), r.evidence.ceilings);
        plainRuns.push({
          summary: p.summary,
          passNotKnown: p.rows.filter((x) => x.passes && !x.widelyKnown).length,
          itemHashes: p.rows.filter((x) => x.qlooId).map((x) => hash(x.qlooId)),
          nameHashes: p.rows.map((x) => hash(x.name.toLowerCase())),
          usage: p.usage,
        });
        full.push({ id: f.id, run: k + 1, plainRows: p.rows });
      }
    }
    rows.push({
      id: f.id, set: f.set, status: card.status === "ok" ? "built" : "thin", reason: card.status === "ok" ? null : "fewer than six items survived the rules",
      items: card.items.length, personal: card.items.filter((i) => i.label === "personal").length, widelyKnown: card.items.filter((i) => i.label === "widely_known").length,
      rejected: card.rejections.length, decisions: card.decisions.length, itemHashes: card.items.map((i) => hash(i.entityId)),
      liveCalls: card.calls.filter((c) => !c.cached).length, ms: Date.now() - t0, tokens: r.usage.inputTokens + r.usage.outputTokens,
      plainRuns,
    });
    full.push({ id: f.id, card, evidence: r.evidence });
    console.log(`${f.id}: ${card.status}, ${card.items.length} items${plainRuns.length ? `, plain AI passing ${plainRuns.map((x) => `${x.summary.passing}/${x.summary.total}`).join(" ")}` : ""}`);
  } catch (e) {
    rows.push({ id: f.id, set: f.set, status: "error", reason: `${e.code ?? e.name}`, itemHashes: [] });
    console.log(`${f.id}: error ${e.code ?? e.name}`);
    if (e.code === "QLOO_DAILY_CAP" || e.code === "QLOO_AUTH") break;
  }
}

const runAt = new Date().toISOString();
mkdirSync("data/runs", { recursive: true });
writeFileSync(`data/runs/eval-${runAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({ runAt, full }, null, 1));
writeFileSync("docs/eval-summary.json", JSON.stringify({ runAt, model: model ? { provider: model.provider, id: model.id } : null, plainRunsPerForm: RUNS, prereg: pre.hashes, rows }, null, 1));
console.log(`Wrote docs/eval-summary.json (${rows.length} forms). Now run: node scripts/facts.mjs`);
