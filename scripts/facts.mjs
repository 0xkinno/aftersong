// Writes docs/FACTS.json from docs/eval-summary.json and docs/matrix-summary.json. No number is typed
// by hand. With --check it recomputes and fails if a committed copy differs. README, the UI and /stats
// read FACTS.json. Also writes web/lib/findings.json (the discovery sentence) from the probe matrix.
// Usage: node scripts/facts.mjs [--check]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mean, round, signTest } from "../backend/src/stats.ts";

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const summary = read("docs/eval-summary.json");
const review = read("docs/review-summary.json");
const matrix = read("docs/matrix-summary.json");
const sessionsSrc = read("docs/sessions.json");

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const m1 = (xs) => round(mean(xs), 1);

function forSet(rows) {
  const built = rows.filter((r) => r.status === "built");
  const abstained = rows.filter((r) => r.status === "thin");
  const withPlain = built.filter((r) => (r.plainRuns ?? []).length > 0);
  const runs = withPlain.flatMap((r) => r.plainRuns);
  const items = built.reduce((a, r) => a + r.items, 0);
  const plainItems = runs.reduce((a, x) => a + x.summary.total, 0);
  const sum = (k) => runs.reduce((a, x) => a + x.summary[k], 0);

  // generic overlap: share of card items whose id appears on more than half of this set's cards
  const freq = new Map();
  for (const r of built) for (const h of new Set(r.itemHashes)) freq.set(h, (freq.get(h) ?? 0) + 1);
  const common = new Set([...freq].filter(([, n]) => n > built.length / 2).map(([h]) => h));
  const commonItems = built.reduce((a, r) => a + r.itemHashes.filter((h) => common.has(h)).length, 0);

  // the plain model's items against Aftersong's
  const stability = withPlain.map((r) => {
    const all = r.plainRuns.map((x) => new Set(x.nameHashes));
    const union = new Set(all.flatMap((s) => [...s]));
    const inAll = [...union].filter((h) => all.every((s) => s.has(h))).length;
    return { distinct: union.size, stable: union.size ? (inAll / union.size) * 100 : 0 };
  });
  const aftersongAlsoPlain = withPlain.reduce((a, r) => a + r.itemHashes.filter((h) => r.plainRuns.some((x) => x.itemHashes.includes(h))).length, 0);
  const aftersongItemsWithPlain = withPlain.reduce((a, r) => a + r.itemHashes.length, 0);

  // paired by form: Aftersong personal items against the plain model's passing, not widely known items
  const diffs = withPlain.map((r) => r.personal - (mean(r.plainRuns.map((x) => x.passNotKnown)) ?? 0));
  return {
    forms: rows.length,
    cardsBuilt: built.length,
    cardsThin: abstained.length,
    errors: rows.filter((r) => r.status === "error").length,
    aftersongItems: items,
    personalRatePct: pct(built.reduce((a, r) => a + r.personal, 0), items),
    widelyKnownRatePct: pct(built.reduce((a, r) => a + r.widelyKnown, 0), items),
    genericOverlapPct: pct(commonItems, items),
    plainRunsPerForm: runs.length && withPlain.length ? Math.round(runs.length / withPlain.length) : 0,
    plainAiItems: plainItems,
    plainAiPassingRulesPct: pct(sum("passing"), plainItems),
    plainAiOutsideYearsPct: pct(sum("outsideWindow"), plainItems),
    plainAiNotInQlooPct: pct(sum("notInQloo"), plainItems),
    plainAiNotConnectedPct: pct(sum("notConnected"), plainItems),
    plainAiWidelyKnownPct: pct(sum("widelyKnown"), plainItems),
    plainAiDistinctItemsPerForm: m1(stability.map((x) => x.distinct)),
    plainAiItemsInEveryRunPct: m1(stability.map((x) => x.stable)),
    aftersongItemsAlsoSuggestedByPlainPct: pct(aftersongAlsoPlain, aftersongItemsWithPlain),
    personalItemsPerCardAftersong: m1(withPlain.map((r) => r.personal)),
    personalItemsPerRunPlainAi: m1(withPlain.map((r) => mean(r.plainRuns.map((x) => x.passNotKnown)) ?? 0)),
    signTestPersonalPerCard: withPlain.length ? signTest(diffs) : null,
    meanLiveQlooCallsPerCard: m1(built.map((r) => r.liveCalls)),
    meanBuildSeconds: m1(built.map((r) => r.ms / 1000)),
    meanTokensPerCard: m1(built.map((r) => r.tokens)),
  };
}

const facts = {
  generatedFrom: {
    eval: summary ? { file: "docs/eval-summary.json", runAt: summary.runAt, model: summary.model, prereg: summary.prereg ?? null } : null,
    matrix: matrix ? { file: "docs/matrix-summary.json", runAt: matrix.runAt, prereg: matrix.preregCommit ?? null } : null,
  },
  note: "Aftersong's own era-fit and connection rates are enforced by rules in code, so they are 100 percent by construction and are not reported as results. The measured comparison is the plain AI list, run through the same rules, three runs per form.",
  curated: summary ? forSet(summary.rows.filter((r) => r.set === "curated")) : null,
  wild: summary ? forSet(summary.rows.filter((r) => r.set === "wild")) : null,
  findings: matrix ? matrix.findings : null,
  review: review ?? null,
  sessions: sessionsSrc ? { participants: sessionsSrc.participants.length, formTarget: sessionsSrc.formTarget, shortfall: Math.max(0, sessionsSrc.formTarget - sessionsSrc.participants.length), recordedOn: sessionsSrc.recordedOn, sessionDate: sessionsSrc.sessionDate, durationMinutes: sessionsSrc.durationMinutes, reportedBy: sessionsSrc.reportedBy, entries: sessionsSrc.participants, humanReview: sessionsSrc.humanReview, humanReviewNote: sessionsSrc.humanReviewNote ?? null } : null,
  misses: summary ? summary.rows.filter((r) => r.status !== "built").map((r) => ({ id: r.id, set: r.set, status: r.status, reason: r.reason })) : [],
};

const findingsWeb = { generatedFrom: matrix ? "docs/matrix-summary.json" : null, sentence: matrix?.discoverySentence ?? null, strongest: matrix?.strongest ?? null };

const out = JSON.stringify(facts, null, 2) + "\n";
const outFindings = JSON.stringify(findingsWeb, null, 2) + "\n";
const copies = [["docs/FACTS.json", out], ["web/lib/facts.json", out], ["web/lib/findings.json", outFindings]];

if (process.argv.includes("--check")) {
  const stale = copies.filter(([p, body]) => !existsSync(p) || readFileSync(p, "utf8") !== body).map(([p]) => p);
  if (stale.length) {
    console.error(`${stale.join(", ")} does not match its source. Run: node scripts/facts.mjs`);
    process.exit(1);
  }
  console.log("FACTS.json, findings.json and their web copies match their sources.");
} else {
  for (const [p, body] of copies) writeFileSync(p, body);
  console.log(summary ? "Wrote FACTS.json and findings.json from the latest runs." : "No eval yet. Wrote FACTS.json with empty results.");
}
