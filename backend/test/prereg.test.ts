import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// Runs the real prereg module inside a throwaway git repository.
const MOD = new URL("../../scripts/lib/prereg.mjs", import.meta.url).href;
function run(dir: string, code: string) {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `import { verifyPrereg, writeHashes } from "${MOD}"; ${code}`], { cwd: dir, encoding: "utf8" }));
}
function repo() {
  const d = mkdtempSync(join(tmpdir(), "prereg-"));
  const g = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: d, encoding: "utf8" });
  g("init", "-q");
  mkdirSync(join(d, "data/eval"), { recursive: true });
  mkdirSync(join(d, "data/wild"), { recursive: true });
  writeFileSync(join(d, "data/eval/forms.json"), '[{"id":"c01"}]');
  return { d, g };
}

test("eval inputs: refuses when nothing is registered, passes when committed, refuses after any change", () => {
  const { d, g } = repo();
  assert.equal(run(d, "console.log(JSON.stringify(verifyPrereg()))").ok, false);
  run(d, "writeHashes(); console.log('{}')");
  assert.equal(run(d, "console.log(JSON.stringify(verifyPrereg()))").ok, false, "written but not committed");
  g("add", "-A");
  g("commit", "-q", "-m", "prereg");
  assert.equal(run(d, "console.log(JSON.stringify(verifyPrereg()))").ok, true);
  writeFileSync(join(d, "data/eval/forms.json"), '[{"id":"c01"},{"id":"c02"}]');
  const after = run(d, "console.log(JSON.stringify(verifyPrereg()))");
  assert.equal(after.ok, false);
  assert.ok(after.problems.some((p: string) => p.includes("changed after it was pre-registered")));
});

test("wild forms: a file that was not hashed and committed blocks the run", () => {
  const { d, g } = repo();
  run(d, "writeHashes(); console.log('{}')");
  g("add", "-A");
  g("commit", "-q", "-m", "prereg");
  writeFileSync(join(d, "data/wild/forms.json"), '[{"id":"w01"}]');
  const r = run(d, "console.log(JSON.stringify(verifyPrereg()))");
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p: string) => p.includes("wild")));
  run(d, "writeHashes(); console.log('{}')");
  g("add", "-A");
  g("add", "-f", "data/wild/forms.json");
  g("commit", "-q", "-m", "wild hash");
  assert.equal(run(d, "console.log(JSON.stringify(verifyPrereg()))").ok, true);
});
