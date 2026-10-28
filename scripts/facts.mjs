// Writes docs/FACTS.json from docs/eval-summary.json. No number is typed by hand. With --check it
// recomputes and fails if the committed FACTS.json differs. README, the UI and /stats read FACTS.json.
// Usage: node scripts/facts.mjs [--check]
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const summaryPath = "docs/eval-summary.json";
const reviewPath = "docs/review-summary.json";
const summary = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, "utf8")) : null;
const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, "utf8")) : null;

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

function forSet(rows) {
  const built = rows.filter((r) => r.status === "built");
  const abstained = rows.filter((r) => r.status === "thin");
  const withPlain = built.filter((r) => r.plain);
  const items = built.reduce((a, r) => a + r.items, 0);
  const plainItems = withPlain.reduce((a, r) => a + r.plain.total, 0);
  // generic overlap: share of card items whose id appears in more than half of this set's cards
  const freq = new Map();
  for (const r of built) for (const h of new Set(r.itemHashes)) freq.set(h, (freq.get(h) ?? 0) + 1);
  const common = new Set([...freq].filter(([, n]) => n > built.length / 2).map(([h]) => h));
  const commonItems = built.reduce((a, r) => a + r.itemHashes.filter((h) => common.has(h)).length, 0);
  return {
    forms: rows.length,
    cardsBuilt: built.length,
    cardsThin: abstained.length,
    errors: rows.filter((r) => r.status === "error").length,
    aftersongItems: items,
    personalRatePct: pct(built.reduce((a, r) => a + r.personal, 0), items),
    widelyKnownRatePct: pct(built.reduce((a, r) => a + r.widelyKnown, 0), items),
    genericOverlapPct: pct(commonItems, items),
    plainAiItems: plainItems,
    plainAiPassingRulesPct: pct(withPlain.reduce((a, r) => a + r.plain.passing, 0), plainItems),
    plainAiOutsideYearsPct: pct(withPlain.reduce((a, r) => a + r.plain.outsideWindow, 0), plainItems),
    plainAiNotInQlooPct: pct(withPlain.reduce((a, r) => a + r.plain.notInQloo, 0), plainItems),
    plainAiNotConnectedPct: pct(withPlain.reduce((a, r) => a + r.plain.notConnected, 0), plainItems),
    plainAiWidelyKnownPct: pct(withPlain.reduce((a, r) => a + r.plain.widelyKnown, 0), plainItems),
    meanLiveQlooCallsPerCard: mean(built.map((r) => r.liveCalls)),
    meanBuildSeconds: mean(built.map((r) => r.ms / 1000)),
    meanTokensPerCard: mean(built.map((r) => r.tokens)),
  };
}

const facts = {
  generatedFrom: summary ? { file: summaryPath, runAt: summary.runAt, model: summary.model } : null,
  note: "Aftersong's own era-fit and connection rates are enforced by rules in code, so they are 100 percent by construction and are not reported as results. The measured comparison is the plain AI list run through the same rules.",
  curated: summary ? forSet(summary.rows.filter((r) => r.set === "curated")) : null,
  wild: summary ? forSet(summary.rows.filter((r) => r.set === "wild")) : null,
  review: review ?? null,
  misses: summary ? summary.rows.filter((r) => r.status !== "built").map((r) => ({ id: r.id, set: r.set, status: r.status, reason: r.reason })) : [],
};

const out = JSON.stringify(facts, null, 2) + "\n";
const copies = ["docs/FACTS.json", "web/lib/facts.json"];
if (process.argv.includes("--check")) {
  const stale = copies.filter((p) => !existsSync(p) || readFileSync(p, "utf8") !== out);
  if (stale.length) {
    console.error(`${stale.join(", ")} does not match docs/eval-summary.json. Run: node scripts/facts.mjs`);
    process.exit(1);
  }
  console.log("FACTS.json and its web copy match their source.");
} else {
  for (const p of copies) writeFileSync(p, out);
  console.log(summary ? "Wrote docs/FACTS.json and web/lib/facts.json from the latest eval." : "No eval yet. Wrote FACTS.json with empty results.");
}
