// Platform probe (G5). Makes real calls to the hackathon API with our own key and records what
// worked, what returned nothing, and what was ignored. Output with no Qloo content (names, ids) is
// written to docs/probe-summary.json and PLATFORM_PROBE.md. The detailed run stays in data/probe/.
// Usage: node scripts/probe.mjs
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { QlooClient } from "../backend/src/qloo/client.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const client = new QlooClient({ key: process.env.QLOO_API_KEY || undefined, host: process.env.QLOO_HOST || undefined, dailyCap: 400 });
if (!client.configured) {
  console.error("QLOO_API_KEY is not set in .env. Nothing was probed and nothing was written.");
  process.exit(2);
}

const results = [];
const rec = (id, what, r) => {
  results.push({ id, what, ...r });
  console.log(`${r.ok ? "ok  " : "FAIL"} ${id}  ${r.note ?? ""}`);
};
const attempt = async (id, what, fn) => {
  try {
    rec(id, what, { ok: true, ...(await fn()) });
  } catch (e) {
    rec(id, what, { ok: false, note: `${e.code ?? e.name}: ${e.message}`.slice(0, 120) });
  }
};
const share = (xs, f) => (xs.length ? Math.round((xs.filter(f).length / xs.length) * 100) : null);
const W = { start: 1952, end: 1972 };

let artist, movie, tv, loc;
await attempt("search.artist", "/search with types=urn:entity:artist", async () => {
  const r = await client.search("Sam Cooke", "urn:entity:artist", 5);
  artist = r.entities[0];
  return { count: r.entities.length, note: `${r.entities.length} results; fields: type=${artist?.type ?? "none"}` };
});
await attempt("search.untyped", "/search without types", async () => {
  const r = await client.search("Casablanca", undefined, 5);
  movie = r.entities.find((e) => (e.type ?? "").includes("movie") || e.types.some((t) => t.includes("movie"))) ?? r.entities[0];
  return { count: r.entities.length, note: `${r.entities.length} results; top type=${movie?.type ?? "none"}` };
});
await attempt("search.locality", "/search types=urn:entity:locality", async () => {
  const r = await client.search("Port Harcourt", "urn:entity:locality", 3);
  loc = r.entities[0];
  return { count: r.entities.length, note: `${r.entities.length} results` };
});
await attempt("search.tvshow", "/search types=urn:entity:tv_show", async () => {
  const r = await client.search("I Love Lucy", "urn:entity:tv_show", 3);
  tv = r.entities[0];
  return { count: r.entities.length, note: `${r.entities.length} results` };
});
await attempt("tags.search", "/v2/tags filter.query with semantic search", async () => {
  const r = await client.tags("West African cuisine", 10);
  return { count: r.tags.length, tagTypesSeen: [...new Set(r.tags.map((t) => t.type).filter(Boolean))], note: `${r.tags.length} tags; cuisine-like: ${r.tags.filter((t) => /cuisine/i.test(t.id)).length}` };
});
await attempt("tags.era", "/v2/tags for a decade word", async () => {
  const r = await client.tags("1960s", 10);
  return { count: r.tags.length, note: `${r.tags.length} tags; decade-like: ${r.tags.filter((t) => /19[0-9]0s/.test(`${t.name} ${t.id}`)).length}` };
});
await attempt("entities.batch", "/entities?entity_ids= batch", async () => {
  const ids = [artist?.id, movie?.id].filter(Boolean);
  const r = await client.entities(ids);
  const keys = new Set();
  return { count: r.entities.length, note: `${r.entities.length} of ${ids.length}; year on movie: ${r.entities.find((e) => e.id === movie?.id)?.year ?? "none"}; tags on artist: ${r.entities.find((e) => e.id === artist?.id)?.tags.length ?? 0}` };
});

let musicStrategy = "unknown";
if (artist) {
  await attempt("insights.artist.entities", "insights artist from favourite", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": artist.id, "feature.explainability": true, take: 30 });
    const withYear = share(r.entities, (e) => e.yearSource?.startsWith("property"));
    const withDecade = share(r.entities, (e) => e.yearSource === "tag:decade");
    const inWindow = share(r.entities.filter((e) => e.year !== null), (e) => e.year <= W.end && (e.yearEnd ?? e.year) >= W.start);
    musicStrategy = withYear > 50 ? "property" : withDecade > 30 ? "decade-tag" : "none";
    return { count: r.entities.length, withYearPct: withYear, withDecadeTagPct: withDecade, inWindowPctOfDated: inWindow, explainability: r.entities.some((e) => e.explainability), popularity: r.entities.some((e) => e.popularity !== null), affinity: r.entities.some((e) => e.affinity !== null), note: `${r.entities.length} results; year property ${withYear}%, decade tag ${withDecade}%; explainability ${r.entities.some((e) => e.explainability)}` };
  });
  await attempt("insights.artist.releaseyear", "artist with filter.release_year (expect ignored)", async () => {
    const a = await client.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": artist.id, take: 30 });
    const b = await client.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": artist.id, "filter.release_year.min": W.start, "filter.release_year.max": W.end, take: 30 });
    const same = a.entities.map((e) => e.id).join() === b.entities.map((e) => e.id).join();
    return { count: b.entities.length, ignored: same, note: same ? "year filter ignored for artists (same results)" : "year filter changed artist results" };
  });
  await attempt("insights.artist.cohort", "artist with signal.demographics.age=55_and_older only", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:artist", "signal.demographics.age": "55_and_older", take: 30 });
    return { count: r.entities.length, note: `${r.entities.length} results` };
  });
  await attempt("insights.artist.rescore", "artist re-score with filter.results.entities", async () => {
    const base = await client.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": artist.id, take: 10 });
    const ids = base.entities.slice(0, 5).map((e) => e.id);
    const r = await client.insights({ "filter.type": "urn:entity:artist", "signal.demographics.age": "55_and_older", "filter.results.entities": ids.join(",") });
    return { count: r.entities.length, asked: ids.length, note: `asked ${ids.length}, got ${r.entities.length} back` };
  });
  await attempt("insights.person.dob", "person born in a window (musician fallback)", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:person", "signal.interests.entities": artist.id, "filter.date_of_birth.min": 1915, "filter.date_of_birth.max": 1950, take: 20 });
    return { count: r.entities.length, note: `${r.entities.length} results` };
  });
}
if (movie) {
  await attempt("insights.movie.releaseyear", "movie with filter.release_year.min/max", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:movie", "signal.interests.entities": movie.id, "filter.release_year.min": W.start, "filter.release_year.max": W.end, "feature.explainability": true, take: 30 });
    const dated = r.entities.filter((e) => e.year !== null);
    return { count: r.entities.length, inWindowPct: share(dated, (e) => e.year >= W.start && e.year <= W.end), datedPct: share(r.entities, (e) => e.year !== null), explainability: r.entities.some((e) => e.explainability), note: `${r.entities.length} results; ${share(dated, (e) => e.year >= W.start && e.year <= W.end)}% in window of those with a year` };
  });
}
if (tv) {
  await attempt("insights.tv.releaseyear", "tv_show with filter.release_year.min/max", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:tv_show", "signal.interests.entities": tv.id, "filter.release_year.min": W.start, "filter.release_year.max": W.end, take: 30 });
    const dated = r.entities.filter((e) => e.year !== null);
    return { count: r.entities.length, inWindowPct: share(dated, (e) => e.year >= W.start && e.year <= W.end), note: `${r.entities.length} results; in window ${share(dated, (e) => e.year >= W.start && e.year <= W.end)}%` };
  });
}
if (artist && loc) {
  await attempt("insights.place.cuisine", "place with cuisine tag and signal.location (locality id)", async () => {
    const tags = await client.tags("West African cuisine", 10);
    const cuisine = tags.tags.filter((t) => /cuisine/i.test(t.id)).slice(0, 2).map((t) => t.id);
    const san = await client.search("San Antonio, Texas", "urn:entity:locality", 1);
    if (!san.entities[0]) return { count: 0, note: "no locality for the care city" };
    const p = { "filter.type": "urn:entity:place", "signal.location": san.entities[0].id, take: 10 };
    if (cuisine.length) p["filter.tags"] = cuisine.join(",");
    else p["signal.interests.entities"] = artist.id;
    const r = await client.insights(p);
    return { count: r.entities.length, cuisineTags: cuisine.length, note: `${r.entities.length} places; cuisine tags used ${cuisine.length}` };
  });
  await attempt("insights.destination.hometown", "destination with signal.location (hometown) and favourite", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:destination", "signal.interests.entities": artist.id, "signal.location": loc.id, take: 10 });
    return { count: r.entities.length, note: `${r.entities.length} destinations` };
  });
  await attempt("insights.artist.hometown", "artist with signal.location (hometown) added", async () => {
    const r = await client.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": artist.id, "signal.location": loc.id, take: 10 });
    return { count: r.entities.length, note: `${r.entities.length} results` };
  });
}
if (artist && movie) {
  await attempt("compare.groups", "/v2/analysis/compare with two groups of entities", async () => {
    const r = await client.compare([artist.id], [movie.id]);
    const names = JSON.stringify(r.body).length;
    return { count: names > 2 ? 1 : 0, note: `answered, ${names} bytes` };
  });
  await attempt("trending.entities", "/v2/trending with entities and a date range", async () => {
    const r = await client.trending([artist.id], "urn:entity:artist", "2026-09-01", "2026-09-30");
    return { count: r.entities.length, note: `${r.entities.length} results` };
  });
}
await attempt("audiences.filter", "/v2/audiences with one audience filter", async () => {
  const r = await client.audiences("urn:audience:communities");
  return { count: 1, note: `answered, ${JSON.stringify(r.body).length} bytes` };
});
await attempt("guard.unsupported", "an unsupported type is refused before sending", async () => {
  try {
    await client.get("/v2/insights", { "filter.type": "urn:entity:music" });
    return { ok: false, note: "unexpectedly passed" };
  } catch (e) {
    return { count: 0, note: `Qloo refused or guard refused: ${e.code}` };
  }
});

const decision = {
  musicEraStrategy: musicStrategy,
  rationale: { property: "artist results carry a year property; used as the era", "decade-tag": "artist results carry decade tags such as 1960s; used as a span", none: "artists carry no era; music needs the person route or must be reported as limited", unknown: "no artist probe ran" }[musicStrategy],
};
const summary = { at: new Date().toISOString(), host: process.env.QLOO_HOST || "https://hackathon.api.qloo.com", liveCalls: client.liveCallsToday(), rateHeaders: client.lastRateHeaders, decision, results };
mkdirSync("data/probe", { recursive: true });
writeFileSync(`data/probe/probe-${summary.at.replace(/[:.]/g, "-")}.json`, JSON.stringify(summary, null, 2));
writeFileSync("docs/probe-summary.json", JSON.stringify(summary, null, 2));

const rows = results.map((r) => `| \`${r.id}\` | ${r.what} | ${r.ok ? "worked" : "failed"} | ${(r.note ?? "").replace(/\|/g, "/")} |`).join("\n");
writeFileSync(
  "PLATFORM_PROBE.md",
  `# PLATFORM_PROBE.md (Gate G5)\n\nGenerated by \`node scripts/probe.mjs\` on ${summary.at} against ${summary.host} with our own key.\nThe summary holds counts and field presence only, no entity names. ${summary.liveCalls} live calls.\n\n| Probe | What | Result | Detail |\n|---|---|---|---|\n${rows}\n\n## Decision: music era strategy\n\n**${decision.musicEraStrategy}**: ${decision.rationale}\n\nRate headers seen: ${JSON.stringify(summary.rateHeaders)}\n\n## Not probed\nHarness MCP tools (not used, see SDK_SURFACE.md), trends, audiences, heatmaps, books, podcasts, brands, video games.\n`,
);
console.log(`\nMusic era strategy: ${decision.musicEraStrategy}. Wrote PLATFORM_PROBE.md and docs/probe-summary.json.`);
