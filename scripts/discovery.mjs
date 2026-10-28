// Gate G3: a minimal script that exercises the Qloo year window, the cohort signal and same-pool
// re-scoring for real, on one resident. Prints counts only, writes the run log into DISCOVERY.md.
// Names stay out of committed files. Usage: node scripts/discovery.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { QlooClient } from "../backend/src/qloo/client.ts";
import { findDomain } from "../backend/src/qloo/find.ts";
import { resolveFavourite } from "../backend/src/qloo/resolve.ts";
import { labelFor } from "../backend/src/core/classify.ts";
import { bumpWindow } from "../backend/src/core/window.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const client = new QlooClient({ key: process.env.QLOO_API_KEY || undefined, host: process.env.QLOO_HOST || undefined, dailyCap: 100 });
if (!client.configured) {
  console.error("QLOO_API_KEY is not set in .env. Nothing was run.");
  process.exit(2);
}
const window = bumpWindow(1940);
const sc = await resolveFavourite(client, "Sam Cooke");
const cs = await resolveFavourite(client, "Casablanca");
const ids = [sc.matches[0]?.id, cs.matches[0]?.id].filter(Boolean);
const log = [];
for (const domain of ["music", "film", "tv"]) {
  const r = await findDomain({ client, domain, signalEntityIds: ids, window, excludeIds: [] });
  const labels = r.candidates.map((c) => labelFor(c).label);
  const inWindow = r.candidates.filter((c) => c.year !== null && c.year <= window.end && (c.yearEnd ?? c.year) >= window.start).length;
  const personal = labels.filter((l) => l === "personal").length;
  const shared = labels.filter((l) => l === "shared_era").length;
  const known = labels.filter((l) => l === "widely_known").length;
  const own = new Set(r.candidates.filter((c) => c.personalRank !== null && c.personalRank <= 10).map((c) => c.id));
  const gen = new Set(r.candidates.filter((c) => c.cohortRank !== null && c.cohortRank <= 10).map((c) => c.id));
  const overlap = [...own].filter((x) => gen.has(x)).length;
  log.push(`| ${domain} | ${r.candidates.length} | ${inWindow} | ${personal} | ${shared} | ${known} | ${overlap} of ${own.size} | ${r.callIds.length} |`);
  console.log(domain, { candidates: r.candidates.length, inWindow, personal, shared, known, overlapTop10: overlap });
}
const stamp = new Date().toISOString();
const table = `Run ${stamp}. Resident born 1940, window ${window.start} to ${window.end}, two confirmed favourites. Counts only.\n\n| Domain | Candidates | Inside the window | Personal | Shared era | Widely known | Top 10 shared with his generation | Qloo calls |\n|---|---|---|---|---|---|---|---|\n${log.join("\n")}\n\nCommand: \`node scripts/discovery.mjs\``;
let md = readFileSync("DISCOVERY.md", "utf8");
md = md.replace(/(<!-- run:start -->)[\s\S]*?(<!-- run:end -->)/, `$1\n${table}\n$2`);
writeFileSync("DISCOVERY.md", md);
mkdirSync("data/probe", { recursive: true });
console.log("Updated DISCOVERY.md run log.");
