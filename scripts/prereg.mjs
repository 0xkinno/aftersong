// Usage: node scripts/prereg.mjs --write   (then commit data/eval/PREREG.sha256.json)
//        node scripts/prereg.mjs            (verify)
import { verifyPrereg, writeHashes } from "./lib/prereg.mjs";

if (process.argv.includes("--write")) {
  const h = writeHashes();
  console.log("Wrote data/eval/PREREG.sha256.json", { forms: h.forms?.slice(0, 12), wild: h.wild ? h.wild.slice(0, 12) : null });
  console.log("Commit it before any eval run.");
} else {
  const r = verifyPrereg();
  console.log(r.ok ? "Pre-registration holds." : `Pre-registration problems:\n- ${r.problems.join("\n- ")}`);
  process.exit(r.ok ? 0 : 1);
}
