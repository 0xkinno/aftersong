// Builds docs/SOURCES.md and web/lib/sources.json from docs/sources.json.
import { readFileSync, writeFileSync } from "node:fs";
const data = JSON.parse(readFileSync("docs/sources.json", "utf8"));
const rows = data.sources.map((s) => `| ${s.stat} ${s.statement} | [${s.label}](${s.url})${s.doi ? ` ([DOI](${s.doi}))` : ""} | ${s.verified} |`).join("\n");
writeFileSync("docs/SOURCES.md", `# Sources\n\nEach figure was checked against its source on ${data.checkedOn}. A figure that could not be confirmed was removed.\n\n| What is true | Source | How it was checked |\n|---|---|---|\n${rows}\n`);
writeFileSync("web/lib/sources.json", JSON.stringify(data, null, 2) + "\n");
console.log("wrote docs/SOURCES.md and web/lib/sources.json");
