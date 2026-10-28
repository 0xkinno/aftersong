// Fails when committed files contain terms listed in reference/blocked-terms.txt (local only,
// gitignored) or when public surfaces contain wording kept for the evidence file.
// Usage: node scripts/check-clean.mjs [--staged]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const staged = process.argv.includes("--staged");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const files = new Set(git("ls-files", "-z").split("\0").filter(Boolean));
if (staged) git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0").filter(Boolean).forEach((f) => files.add(f));

const isText = (buf) => !buf.subarray(0, 4096).includes(0);
const failures = [];

// 1. Local list of blocked terms. Absent on a clean clone and in CI, where it is skipped.
const termsPath = "reference/blocked-terms.txt";
if (existsSync(termsPath)) {
  const terms = readFileSync(termsPath, "utf8").split(/\r?\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith("#"));
  const re = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  for (const f of files) {
    if (!existsSync(f)) continue;
    const buf = readFileSync(f);
    if (!isText(buf)) continue;
    const m = re.exec(buf.toString("utf8"));
    if (m) failures.push(`${f}: contains blocked term "${m[0]}"`);
  }
} else {
  console.warn("check-clean: reference/blocked-terms.txt not found, term check skipped");
}

// 2. Wording that belongs in EVIDENCE.md only, never on a public surface.
const publicSurface = /^(README\.md|web\/(app|components|public)\/|docs\/screens\/)/;
for (const f of files) {
  if (!publicSurface.test(f) || !existsSync(f)) continue;
  const buf = readFileSync(f);
  if (!isText(buf)) continue;
  if (/fictional/i.test(buf.toString("utf8"))) failures.push(`${f}: public surface must not use the word "fictional" (keep it in EVIDENCE.md)`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("check-clean: ok");
