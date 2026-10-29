// The pre-registered findings F1 to F5 (docs/PREREG.md). Makes live Qloo calls, so it needs the key
// and spends quota. It refuses to run unless docs/PREREG.md and the eval inputs are committed and
// unchanged, and it cites the commit in FINDINGS.md. Every number in FINDINGS.md comes from
// backend/src/matrix.ts. Usage: node scripts/probe-matrix.mjs [--limit N]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runCardAgent, NeedsConfirmation } from "../backend/src/agent/agent.ts";
import { QlooClient } from "../backend/src/qloo/client.ts";
import { autoConfirm, resolveCuisineTags, resolveLocality } from "../backend/src/qloo/resolve.ts";
import { DOMAIN_TYPE, COHORT_BRACKET } from "../backend/src/qloo/find.ts";
import { bumpWindow } from "../backend/src/core/window.ts";
import { routeSignals } from "../backend/src/core/route.ts";
import { computeF1, computeF2, computeF3, computeF4, computeF5, discoverySentence } from "../backend/src/matrix.ts";
import { FORMS, verifyPrereg } from "./lib/prereg.mjs";

if (existsSync(".env")) process.loadEnvFile(".env");
const limit = Number(process.argv.includes("--limit") ? process.argv[process.argv.indexOf("--limit") + 1] : 999);
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

// 1. pre-registration must hold
const problems = [];
if (!existsSync("docs/PREREG.md")) problems.push("docs/PREREG.md is missing");
else {
  if (!git("log", "-1", "--format=%H", "--", "docs/PREREG.md")) problems.push("docs/PREREG.md is not committed");
  if (git("status", "--porcelain", "--", "docs/PREREG.md")) problems.push("docs/PREREG.md has uncommitted changes");
}
const pre = verifyPrereg();
if (!pre.ok) problems.push(...pre.problems);
if (problems.length) {
  console.error(`Refusing to run. The findings are not pre-registered:\n- ${problems.join("\n- ")}`);
  process.exit(3);
}
const preregCommit = git("log", "-1", "--format=%H", "--", "docs/PREREG.md");

const client = new QlooClient({ key: process.env.QLOO_API_KEY || undefined, host: process.env.QLOO_HOST || undefined, dailyCap: Number(process.env.DAILY_QLOO_CAP || 3000) });
if (!client.configured) { console.error("QLOO_API_KEY is not set. Nothing was run."); process.exit(2); }

const forms = JSON.parse(readFileSync(FORMS, "utf8")).slice(0, limit);
const take = 30;
const top8 = (es) => es.filter((e) => e.affinity !== null).sort((a, b) => b.affinity - a.affinity).slice(0, 8).map((e) => ({ id: e.id, popularity: e.popularity }));
const yearsParams = (type, w) => (type === "urn:entity:movie" || type === "urn:entity:tv_show" ? { "filter.release_year.min": w.start, "filter.release_year.max": w.end } : {});

const f1 = [], f3 = [], f4 = [], f5 = [], cardItems = [];
const cohortUnion = new Set();
const skipped = [];
const raw = [];

for (const f of forms) {
  try {
    const favourites = [];
    for (const text of f.favourites) {
      const m = await autoConfirm(client, text);
      favourites.push(m ? { text, kind: m.kind, id: m.id, name: m.name, type: m.type, confirmed: true } : { text, kind: "unresolved", id: null, name: null, type: null, confirmed: false });
    }
    const confirmed = favourites.filter((x) => x.confirmed);
    const routes = routeSignals(confirmed, []);
    const own = routes.media.entityIds;
    if (own.length === 0) { skipped.push({ form: f.id, why: "no favourite resolved to a single exact match" }); continue; }
    const w = bumpWindow(f.birthYear);

    // F1 and F4: cohort only versus own signals, film, TV and music, same window
    for (const [domain, type] of [["film", DOMAIN_TYPE.film], ["tv", DOMAIN_TYPE.tv], ["music", DOMAIN_TYPE.music]]) {
      const base = { "filter.type": type, take, ...yearsParams(type, w) };
      // measured 2026-10-29: the age signal alone is a 400; artists need a second filter, a ceiling that excludes nothing
      const cohort = await client.insights({ ...base, ...(domain === "music" ? { "filter.popularity.max": "1" } : {}), "signal.demographics.age": COHORT_BRACKET });
      const mine = await client.insights({ ...base, "signal.interests.entities": own.join(",") });
      for (const e of cohort.entities) cohortUnion.add(e.id);
      f1.push({ form: f.id, domain, cohortTop8: top8(cohort.entities), ownTop8: top8(mine.entities) });
      if (domain !== "music") f4.push({ form: f.id, type: type.split(":").pop(), window: w, years: [...cohort.entities, ...mine.entities].map((e) => e.year) });
      raw.push({ form: f.id, domain, cohort: cohort.entities.length, own: mine.entities.length });
    }

    // F3: does the music anchor move film?
    const musicIds = confirmed.filter((x) => x.kind === "entity" && /artist|music/i.test(x.type ?? "")).map((x) => x.id);
    const filmIds = confirmed.filter((x) => x.kind === "entity" && /movie|tv_show/i.test(x.type ?? "")).map((x) => x.id);
    if (musicIds.length && filmIds.length) {
      const base = { "filter.type": DOMAIN_TYPE.film, take, ...yearsParams(DOMAIN_TYPE.film, w) };
      const pool = (await client.insights({ ...base, "signal.interests.entities": [...filmIds, ...musicIds].join(",") })).entities.slice(0, 40).map((e) => e.id);
      if (pool.length >= 4) {
        const pin = { "filter.results.entities": pool.join(",") };
        const a = await client.insights({ ...base, "signal.interests.entities": filmIds.join(","), ...pin });
        const b = await client.insights({ ...base, "signal.interests.entities": [...filmIds, ...musicIds].join(","), ...pin });
        const order = (r) => r.entities.filter((e) => e.affinity !== null).sort((x, y) => y.affinity - x.affinity).map((e) => e.id);
        f3.push({ form: f.id, withoutMusic: order(a), withMusic: order(b) });
      }
    }

    // F5: hometown signal on an open query
    const [home, care] = [await resolveLocality(client, f.hometown).catch(() => null), await resolveLocality(client, f.careCity).catch(() => null)];
    if (home && care) {
      const tags = await resolveCuisineTags(client, f.hometown.split(",").pop().trim()).catch(() => []);
      if (tags.length) {
        const r = await client.insights({ "filter.type": DOMAIN_TYPE.food, "signal.location": home.id, "filter.tags": tags.map((t) => t.id).join(","), take });
        f5.push({ form: f.id, hometownTokens: f.hometown.split(",").map((s) => s.trim()), careTokens: f.careCity.split(",").map((s) => s.trim()), addresses: r.entities.map((e) => e.address) });
      }
    }

    // F2: cards built with no model; dated items only
    try {
      const resident = { id: f.id, homeId: "matrix", firstName: f.firstName, birthYear: f.birthYear, careCity: f.careCity, hometown: f.hometown, favourites, offsets: { from: 10, to: 30 }, consent: true, consentRecord: null, intakeBy: "carer", familySubmittedAt: null, isSample: false, createdAt: "", updatedAt: "" };
      const r = await runCardAgent({ client, model: null }, { resident, observations: [], cardId: `matrix-${f.id}` });
      cardItems.push({ form: f.id, cardItems: r.card.items.filter((i) => ["music", "film", "tv"].includes(i.domain)).map((i) => i.entityId) });
    } catch (e) {
      if (!(e instanceof NeedsConfirmation)) throw e;
    }
    console.log(`${f.id}: done`);
  } catch (e) {
    skipped.push({ form: f.id, why: `${e.code ?? e.name}` });
    console.log(`${f.id}: skipped ${e.code ?? e.name}`);
    if (e.code === "QLOO_DAILY_CAP" || e.code === "QLOO_AUTH") break;
  }
}

// 2. compute. Each domain of F1 is reported; the headline uses film and music pooled by form.
const byDomain = (d) => computeF1(f1.filter((r) => r.domain === d));
const pooled = [];
for (const form of new Set(f1.map((r) => r.form))) {
  const rs = f1.filter((r) => r.form === form && r.domain !== "tv");
  if (rs.length === 2) pooled.push({ form, domain: "film+music", cohortTop8: rs.flatMap((r) => r.cohortTop8).slice(0, 16), ownTop8: rs.flatMap((r) => r.ownTop8).slice(0, 16) });
}
const F1 = { film: byDomain("film"), tv: byDomain("tv"), music: byDomain("music"), pooled: computeF1(pooled) };
const findings = { F1, F2: computeF2(cardItems, cohortUnion), F3: computeF3(f3), F4: computeF4(f4), F5: computeF5(f5) };
const { sentence, strongest } = discoverySentence(F1.film.supports ? F1.film : F1.pooled, findings.F2);
const runAt = new Date().toISOString();
const summary = { runAt, preregCommit, formsRun: forms.length, formsSkipped: skipped, findings, discoverySentence: sentence, strongest };

mkdirSync("data/probe", { recursive: true });
writeFileSync(`data/probe/matrix-${runAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({ ...summary, raw }, null, 1));
writeFileSync("docs/matrix-summary.json", JSON.stringify(summary, null, 2) + "\n");

// 3. FINDINGS.md, generated from the summary only
const s = (t) => (t === null || t === undefined ? "not available" : t);
const lines = [];
lines.push("# FINDINGS.md", "", `Generated by \`node scripts/probe-matrix.mjs\` on ${runAt}. Pre-registered in \`docs/PREREG.md\`, commit \`${preregCommit}\`. Every number comes from \`docs/matrix-summary.json\`. Negative results are listed with the same weight as positive ones.`, "");
lines.push("Method note: the age signal alone is refused by Qloo (400, measured in PLATFORM_PROBE.md). Cohort-only queries therefore carry the same year window where the type honours one, and a popularity ceiling of 1 (which excludes nothing) for artists. PREREG.md is unchanged.", "");
lines.push(`Forms run: ${forms.length}. Skipped: ${skipped.length}${skipped.length ? ` (${skipped.map((x) => `${x.form}: ${x.why}`).join("; ")})` : ""}.`, "");
const f1row = (name, r) => `| ${name} | ${r.forms} | ${s(r.meanPopularityCohortOnly)} | ${s(r.meanPopularityOwn)} | ${s(r.meanWidelyKnownCohortOnly)} | ${s(r.meanWidelyKnownOwn)} | ${r.sign.positive} / ${r.sign.negative} / ${r.sign.ties} | ${s(r.sign.p === null ? null : r.sign.p.toFixed(4))} | ${r.sign.verdict} |`;
lines.push("## F1. Does the age-cohort signal alone pull a card toward famous defaults?", "", "| Domain | Forms | Mean popularity, cohort only | Mean popularity, his own signals | Widely known in top 8, cohort only | Widely known in top 8, his own | Positive / negative / tie | p | Verdict |", "|---|---|---|---|---|---|---|---|---|", f1row("Film", F1.film), f1row("TV", F1.tv), f1row("Music", F1.music), f1row("Film and music pooled", F1.pooled), "");
lines.push(sentence ? `Discovery sentence (written because F1 is significant in the predicted direction): ${sentence}` : "No discovery sentence was written: F1 did not reach significance in the predicted direction on film or on the pooled set. The landing page keeps its plain claim.", "");
lines.push("## F2. How many of the items Aftersong places would a generic oldies list contain?", "", `Generic list proxy: the union of all cohort-only results across forms (${findings.F2.unionSize} items). Cards checked: ${findings.F2.forms}. Mean share of a card's dated items that are in that union: **${findings.F2.meanOverlapPct}%** (${findings.F2.totalInUnion} of ${findings.F2.totalItems} items). Lower is more personal.`, "");
lines.push("## F3. Does one remembered favourite in music move film?", "", `Forms with a music and a film favourite: ${findings.F3.forms} (skipped ${findings.F3.skipped}). Mean Kendall tau between film order with and without the music anchor: **${s(findings.F3.meanTau)}**. Forms where the order changed at all: ${findings.F3.formsChanged}. A tau near 1 means the music anchor does not move film.`, "");
lines.push("## F4. Does the year filter hold at the edges?", "", "| Type | Returned | With a year | Outside the window | Violations |", "|---|---|---|---|---|", ...Object.entries(findings.F4).map(([k, v]) => `| ${k} | ${v.returned} | ${v.dated} | ${v.outside} | ${s(v.violationPct)}% |`), "");
lines.push("## F5. Does a hometown signal on an open query return places from that region?", "", `Forms: ${findings.F5.forms}. Places with an address: ${findings.F5.placesWithAddress} (no address: ${findings.F5.noAddress}). In the hometown region: **${s(findings.F5.inHometownPct)}%**. In the care home's city: **${s(findings.F5.inCareCityPct)}%**.`, "");
writeFileSync("FINDINGS.md", lines.join("\n"));
console.log(`Wrote FINDINGS.md and docs/matrix-summary.json. Now run: node scripts/facts.mjs`);
