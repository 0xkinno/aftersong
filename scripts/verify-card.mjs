// Offline verifier. Recomputes the six invariants from an exported card and the evidence it was
// built from. Calls neither Qloo nor a model, needs no keys.
// Usage: node scripts/verify-card.mjs <export.json> [--expect-fail]
import { readFileSync } from "node:fs";
import { verifyCard } from "../backend/src/core/verify.ts";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: node scripts/verify-card.mjs <export.json> [--expect-fail]");
  process.exit(2);
}
const { card, evidence, synthetic } = JSON.parse(readFileSync(file, "utf8"));
if (!card || !evidence) {
  console.error("The file needs both card and evidence. Export it from the app: /api/.../export");
  process.exit(2);
}
const r = verifyCard(card, evidence);
console.log(`${synthetic ? "SYNTHETIC fixture. " : ""}Card ${card.id}, ${card.items.length} items, window ${card.window.start} to ${card.window.end}`);
for (const c of r.checks) {
  console.log(`${c.ok ? "pass" : "FAIL"}  ${c.n}. ${c.name}`);
  for (const f of c.failures) console.log(`        ${f}`);
}
const expectFail = args.includes("--expect-fail");
if (expectFail) {
  if (r.ok) {
    console.error("Expected a failure but every check passed.");
    process.exit(1);
  }
  console.log("Failed as expected.");
  process.exit(0);
}
process.exit(r.ok ? 0 : 1);
