// Pre-registration of the eval inputs. The curated forms are committed. For the wild forms only the
// SHA-256 is committed, so the set cannot be changed after the results are seen. The eval refuses to
// run if a committed hash does not match the file on disk, or if the hash file itself is not committed.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const FORMS = "data/eval/forms.json";
export const WILD = "data/wild/forms.json";
export const HASHES = "data/eval/PREREG.sha256.json";

export const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function computeHashes() {
  return { forms: existsSync(FORMS) ? sha256(FORMS) : null, wild: existsSync(WILD) ? sha256(WILD) : null };
}

export function writeHashes() {
  const h = { note: "SHA-256 of the pre-registered eval inputs. Commit this file before any eval run.", ...computeHashes() };
  writeFileSync(HASHES, JSON.stringify(h, null, 2) + "\n");
  return h;
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

/** Returns { ok, problems[] }. Pure apart from reading files and asking git. */
export function verifyPrereg({ requireCommitted = true } = {}) {
  const problems = [];
  if (!existsSync(HASHES)) return { ok: false, problems: [`${HASHES} is missing. Run: node scripts/prereg.mjs --write, then commit it.`] };
  const committed = JSON.parse(readFileSync(HASHES, "utf8"));
  const now = computeHashes();
  if (!committed.forms) problems.push("the committed hash file has no hash for the curated forms");
  else if (committed.forms !== now.forms) problems.push(`${FORMS} changed after it was pre-registered`);
  if (now.wild !== null && committed.wild !== now.wild) problems.push(`${WILD} does not match the committed hash. Wild forms must be hashed and committed before any eval run`);
  if (now.wild === null && committed.wild !== null) problems.push(`${WILD} is missing but a hash for it was committed`);
  if (requireCommitted) {
    try {
      if (!git("log", "-1", "--format=%H", "--", HASHES)) problems.push(`${HASHES} is not committed yet`);
      if (git("status", "--porcelain", "--", HASHES, FORMS)) problems.push(`${HASHES} or ${FORMS} has uncommitted changes`);
    } catch {
      problems.push("could not ask git whether the pre-registration is committed");
    }
  }
  return { ok: problems.length === 0, problems, hashes: committed };
}
