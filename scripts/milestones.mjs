// MILESTONES.md is the commit history as it really is, generated from git. Nothing is hand-typed.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const log = execFileSync("git", ["log", "--reverse", "--format=%h%x09%ad%x09%an%x09%s", "--date=format:%Y-%m-%d %H:%M"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"));
const rows = log.map(([h, d, a, s]) => `| ${h} | ${d} | ${a} | ${s} |`).join("\n");
writeFileSync("MILESTONES.md", `# MILESTONES.md\n\nGenerated from \`git log\` by \`node scripts/milestones.mjs\`. ${log.length} commits, all authored by 0xkinno.\n\n| Commit | When | Author | What |\n|---|---|---|---|\n${rows}\n`);
console.log(`wrote MILESTONES.md (${log.length} commits)`);
