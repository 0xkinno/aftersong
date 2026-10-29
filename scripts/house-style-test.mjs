// House style test: no emoji, no dashes used as punctuation, no hype words in anything a reader sees.
// Scans markdown at the repo root and in docs/, and the web app source. Fenced code is skipped.
// Usage: node scripts/house-style-test.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { houseStyleViolations } from "../backend/src/core/house-style.ts";

const IGNORE = new Set(["HACKATHON_WINNING_SYSTEM_V5.md", "HACKATHON_WINNING_SYSTEM_V5 (1).md", "AFTERSONG_BUILD_INSTRUCTION.md"]);
const files = [];
const walk = (dir, test) => {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", "reference", ".git", "data"].includes(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, test);
    else if (test(p)) files.push(p);
  }
};
for (const n of readdirSync(".")) if (n.endsWith(".md") && !IGNORE.has(n)) files.push(n);
walk("docs", (p) => p.endsWith(".md"));
walk("web/app", (p) => /\.(tsx|ts|css)$/.test(p));
walk("web/components", (p) => /\.(tsx|ts|css)$/.test(p));
walk("web/lib", (p) => /\.(tsx|ts)$/.test(p));

let bad = 0;
for (const f of files) {
  let fence = false;
  readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) return;
    const isCode = /\.(tsx|ts|css)$/.test(f);
    // code files: only string and JSX text matter, so skip comment lines and import lines
    if (isCode && (/^\s*(\/\/|\*|\/\*|import )/.test(line))) return;
    const text = line.replace(/^\s*([-*]|\d+\.)\s+/, "").replace(/`[^`]*`/g, "").replace(/\(https?:[^)]*\)/g, "").replace(/https?:\/\/\S+/g, "");
    const v = houseStyleViolations(isCode ? text.replace(/\s-\s/g, "") : text);
    if (v.length) {
      bad++;
      console.log(`${f}:${i + 1}: ${v.join(", ")}`);
    }
  });
}
// Name style: the product name and headline never use the word "taste". It is for describing Qloo's graph only.
const nameChecks = [
  ["web/app/layout.tsx", /title:\s*"([^"]*)"/],
  ["web/app/page.tsx", /<h1[^>]*>([\s\S]*?)<\/h1>/],
  ["README.md", /^# (.*)$/m],
  ["README.md", /^\*\*(Helps[^*]*)\*\*$/m],
];
for (const [f, re] of nameChecks) {
  const m = readFileSync(f, "utf8").match(re);
  if (!m) { bad++; console.log(`${f}: could not find the name or headline to check`); continue; }
  if (/taste/i.test(m[1])) { bad++; console.log(`${f}: the name or headline uses the word taste: ${m[1]}`); }
}
console.log(bad ? `${bad} house style violation(s).` : `House style ok (${files.length} files).`);
process.exit(bad ? 1 : 0);
