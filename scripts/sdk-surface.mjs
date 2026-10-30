// Generates SDK_SURFACE.md with real file:line pointers. Fails if a claimed call site is missing from
// the code, so the claims cannot drift. Status is "live" only when docs/probe-summary.json shows the
// matching probe worked; otherwise it says the call is built but not yet observed on a live key.
// Usage: node scripts/sdk-surface.mjs [--check]
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const probe = existsSync("docs/probe-summary.json") ? JSON.parse(readFileSync("docs/probe-summary.json", "utf8")) : null;
const probed = (id) => probe?.results?.find((r) => r.id === id);

const FEATURES = [
  ["Resolve favourites with /search", "backend/src/qloo/client.ts", "async search(", "search.untyped", "Carer confirms the match on screen"],
  ["Resolve a place to a locality with /search", "backend/src/qloo/resolve.ts", "urn:entity:locality", "search.locality", "Sent onward as an ID, never as the typed name"],
  ["Cuisine and genre tags with /v2/tags", "backend/src/qloo/client.ts", "async tags(", "tags.search", "feature.semantic_search on"],
  ["Batch lookup with /entities", "backend/src/qloo/client.ts", "async entities(", "entities.batch", "One call for many IDs"],
  ["Insights for the person's own signals", "backend/src/qloo/find.ts", "const personal = await", "insights.artist.entities", "signal.interests.entities, artist, movie, tv_show, place, destination"],
  ["Year window", "backend/src/qloo/find.ts", "base[\"filter.release_year.min\"]", "insights.movie.releaseyear", "Film and television only; enforced again in code for every domain"],
  ["Cohort signal", "backend/src/qloo/find.ts", "signal.demographics.age", "insights.artist.cohort", "55_and_older, the oldest bracket: today's audience, used as a proxy"],
  ["Explainability", "backend/src/qloo/find.ts", "feature.explainability", "insights.artist.entities", "Driver extraction is best effort (topDriver)"],
  ["Popularity as a label", "backend/src/core/classify.ts", "POPULARITY_CEILING", null, "Popularity is read from Qloo; the Widely known cut-off is Aftersong's own, relative to the pool"],
  ["Hometown thread", "backend/src/qloo/find.ts", "signal.location", "insights.destination.hometown", "A point for the place when the locality ID returns nothing (see PLATFORM_PROBE.md)"],
  ["Exclude what upset", "backend/src/qloo/find.ts", "filter.exclude.entities", null, "Also enforced in code"],
  ["Cuisine tags as a signal", "backend/src/qloo/find.ts", "signal.interests.tags", "insights.place.cuisine", "Food near the care home; as a hard filter with a location the probe returned nothing"],
  ["Pinned pool, two rankings (his signals and the cohort)", "backend/src/qloo/find.ts", "const pin: Params", "insights.artist.rescore", "Ranks compared inside each call, never raw affinities across calls"],
  ["Compare two residents in one line", "backend/src/qloo/client.ts", "async compare(", "compare.groups", "/v2/analysis/compare, used by the room planner"],
  ["Room planner re-scoring", "backend/src/agent/group.ts", "filter.results.entities", null, "One pool, one re-score per resident"],
  ["Group planner as an agent tool", "backend/src/agent/group-agent.ts", "export const GROUP_TOOLS", null, "The agent decides when to call plan_group_session; the server computes the plan"],
  ["Aftersong MCP server (stdio, official SDK)", "mcp/server.mjs", "export function buildServer", null, "build_session_card, log_observation, plan_group_session over the same API"],
  ["Plain AI counterfactual lookups", "backend/src/agent/plain.ts", "client.search(it.name", null, "Each suggested item is looked up and checked by the same rules"],
  ["Request allowlist", "backend/src/qloo/guard.ts", "export function assertSafeParams", null, "Only IDs, tags, an age bracket, years, a place"],
  ["Rate discipline", "backend/src/qloo/client.ts", "spacingMs", null, "250 ms spacing, no retry on 429, de-duplication, daily cap"],
];
const hc = existsSync("docs/harness-check.json") ? JSON.parse(readFileSync("docs/harness-check.json", "utf8")) : null;
const harnessCell = hc
  ? [
      hc.harnessVersion + ", run by scripts/harness-check.mjs on " + hc.at.slice(0, 10) + ".",
      "Resolve: " + (hc.resolve?.error ? "failed (" + hc.resolve.error + ")" : hc.resolve?.sameTopId ? "same top entity id as our REST client" : "different top entity id") + ".",
      "Recommend: " + (hc.recommend?.error ? "failed (" + hc.recommend.error + ")" : hc.recommend?.shared + " of " + hc.recommend?.ours + " ids shared (" + hc.recommend?.sharePct + " percent)") + ".",
      "Production calls use REST for rate-limit reasons.",
    ].join(" ")
  : "0.1.26, equivalence check written (scripts/harness-check.mjs), not yet run";
const MODEL = [
  ["Model adapters (Anthropic, OpenRouter, NVIDIA, Groq, Gemini over HTTP, with fallback)", "backend/src/agent/model.ts", "export function modelFromEnv", "Not a Qloo call. A free-tier model id is tried after any credited key"],
  ["Tool-calling loop with five tools and a write_openers channel", "backend/src/agent/agent.ts", "export const TOOLS", "Not a Qloo call. The agent picks tools; rules in code decide the card"],
  ["Fault switch", "backend/src/agent/agent.ts", "function sabotageReply", "Not a Qloo call. Lets a model try an off-card line so the filter can be shown"],
  ["Opener filter (invariant 5)", "backend/src/core/openers.ts", "export function openerViolations", "Not a Qloo call. Blocks names Qloo returned elsewhere and listed health claims"],
];

const line = (file, pat) => {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes(pat));
  if (i < 0) throw new Error(`SDK_SURFACE claim not found in code: ${file} :: ${pat}`);
  return i + 1;
};

const pkg = (p) => JSON.parse(readFileSync(p, "utf8"));
const web = pkg("web/package.json");
const rows = FEATURES.map(([f, file, pat, pid, note]) => {
  const r = pid ? probed(pid) : null;
  const status = pid ? (r ? (r.ok ? `live, probed ${probe.at.slice(0, 10)}` : `built, probe failed: ${r.note}`) : "built, not yet called on a live key") : "built in code";
  return `| ${f} | [${file}:${line(file, pat)}](${file}#L${line(file, pat)}) | ${status} | ${note} |`;
}).join("\n");
const mrows = MODEL.map(([f, file, pat, note]) => `| ${f} | [${file}:${line(file, pat)}](${file}#L${line(file, pat)}) | built in code | ${note} |`).join("\n");

const md = `# SDK_SURFACE.md

Generated by \`node scripts/sdk-surface.mjs\`. It fails if a claimed call site is missing from the code.
Status says "live" only when \`docs/probe-summary.json\` shows the matching probe worked on our own key.

## Versions
| Piece | Version |
|---|---|
| Qloo API | hackathon host, \`${probe?.host ?? "https://hackathon.api.qloo.com"}\`, no version string exposed |
| Qloo harness (\`@qloo/qloo-harness\`) | ${harnessCell} |
| Node | 22.19 or newer (type stripping) |
| Next.js | ${web.dependencies.next} |
| React | ${web.dependencies.react} |
| Model | ${existsSync("docs/eval-summary.json") ? JSON.stringify(JSON.parse(readFileSync("docs/eval-summary.json", "utf8")).model) : "not yet recorded: set in .env and recorded by the first eval run"} |

## Qloo features used
| Feature | Call site | Status | Note |
|---|---|---|---|
${rows}

## Agent and model
| Piece | Call site | Status | Note |
|---|---|---|---|
${mrows}

## Not used, so not claimed
- The Qloo harness in production. It is used only for the equivalence check above. Reason: the event rate limit and our own spacing, caching and request allowlist are easier to enforce on direct calls. See SPONSOR_INTEL.md.
- \`/v2/trending\` and \`/v2/audiences\`: client methods and allowlist entries exist for the probe; the product does not call them.
- The Vercel AI SDK. The tool-calling loop is our own, over each provider's HTTP API.
- Qloo trends, audiences, heatmaps; books, podcasts, brands and video games as card items.
- Storing Qloo response bodies in the repository (the developer guide forbids it). Committed fixtures are synthetic.
`;

if (process.argv.includes("--check")) {
  const have = existsSync("SDK_SURFACE.md") ? readFileSync("SDK_SURFACE.md", "utf8") : "";
  if (have !== md) {
    console.error("SDK_SURFACE.md is out of date. Run: node scripts/sdk-surface.mjs");
    process.exit(1);
  }
  console.log("SDK_SURFACE.md is current.");
} else {
  writeFileSync("SDK_SURFACE.md", md);
  console.log("Wrote SDK_SURFACE.md");
}
