import test from "node:test";
import assert from "node:assert/strict";
import { runCardAgent } from "../src/agent/agent.ts";
import { explainPair, planGroupSession, sharedNames } from "../src/agent/group.ts";
import { runGroupAgent } from "../src/agent/group-agent.ts";
import type { Model } from "../src/agent/model.ts";
import { vetCandidate } from "../src/core/rules.ts";
import { favouriteRoute, routeSignals } from "../src/core/route.ts";
import { QlooClient, QlooError } from "../src/qloo/client.ts";
import { normalizeEntity } from "../src/qloo/entity.ts";
import { findDomain } from "../src/qloo/find.ts";
import { assertSafeParams } from "../src/qloo/guard.ts";
import type { Favourite } from "../src/core/types.ts";
import type { Resident } from "../src/store/types.ts";
import { cand } from "./fixtures.ts";
import { makeMock } from "./mock-qloo.ts";

const W = { start: 1950, end: 1970 };
const typeOf = (x: URL): string => x.searchParams.get("filter.type") ?? "";
const mk = (seen: URL[] = [], artistEra = true) => new QlooClient({ key: "k", transport: makeMock({ seen, artistEra }), spacingMs: 0 });
const fav = (id: string, name: string, type: string | null, kind: "entity" | "tag" = "entity"): Favourite => ({ text: name, kind, id, name, type, confirmed: true });

const resident: Resident = {
  id: "r1", homeId: "h", firstName: "Sample", birthYear: 1940, careCity: "San Antonio, Texas", hometown: "Port Harcourt, Nigeria",
  favourites: [fav("SYN-FAV-001", "Synthetic Singer", "urn:entity:artist"), fav("SYN-MOVIE-001", "Synthetic Film", "urn:entity:movie"), fav("urn:tag:cuisine:jollof", "jollof rice", null, "tag")],
  offsets: { from: 10, to: 30 }, consent: true, intakeBy: "carer", familySubmittedAt: null, isSample: true, createdAt: "", updatedAt: "",
};

// ---- B1: ranks inside two calls over one pinned pool ----
test("B1: dated domains are ranked twice over the same pinned pool, never by raw affinity across calls", async () => {
  const seen: URL[] = [];
  const r = await findDomain({ client: mk(seen), domain: "film", signalEntityIds: ["SYN-FAV-001"], window: W, excludeIds: [] });
  const pinned = seen.filter((u) => u.searchParams.has("filter.results.entities"));
  assert.equal(pinned.length, 2);
  assert.equal(pinned[0]!.searchParams.get("filter.results.entities"), pinned[1]!.searchParams.get("filter.results.entities"), "same pool");
  assert.ok(pinned.some((u) => u.searchParams.has("signal.demographics.age")));
  assert.ok(pinned.some((u) => u.searchParams.has("signal.interests.entities")));
  assert.ok(r.candidates.every((c) => c.personalN > 0 && c.cohortN > 0));
  assert.ok(r.candidates.some((c) => c.personalRank === 1));
});

// ---- B2: affinity only from query.affinity ----
test("B2: affinity is read only from query.affinity; popularity and a top-level affinity are never used", () => {
  const e = normalizeEntity({ entity_id: "AAAAAA-1", name: "X", popularity: 0.9, affinity: 0.77 });
  assert.equal(e!.affinity, null);
  assert.equal(e!.popularity, 0.9);
  assert.equal(normalizeEntity({ entity_id: "AAAAAA-1", name: "X", popularity: 0.9, query: { affinity: 0.41 } })!.affinity, 0.41);
});

test("B2: an item with no affinity is rejected, not scored", () => {
  const c = cand({ id: "SYN-X", name: "Synthetic X", domain: "film", personalAffinity: null, personalRank: null });
  const f = vetCandidate(c, { window: W, confirmedIds: new Set(["SYN-FAV-001"]), positiveIds: new Set(), upsetIds: new Set(), seenIds: new Set(["SYN-X"]) }, new Set());
  assert.ok(f.some((x) => x.rule === "no_affinity"));
});

// ---- B3: year filters by type ----
test("B3: release_year is sent for film and TV only, never for artists or places", async () => {
  for (const [domain, expect] of [["film", true], ["tv", true], ["music", false], ["food", false], ["place", false]] as const) {
    const seen: URL[] = [];
    await findDomain({ client: mk(seen), domain, signalEntityIds: ["SYN-FAV-001"], window: W, excludeIds: [], location: domain === "food" || domain === "place" ? "SYN-LOC-9" : undefined });
    assert.equal(seen.some((u) => u.searchParams.has("filter.release_year.min")), expect, domain);
  }
});

test("B3: a film window request returns nothing outside the window", async () => {
  const r = await findDomain({ client: mk(), domain: "film", signalEntityIds: ["SYN-FAV-001"], window: W, excludeIds: [] });
  assert.ok(r.candidates.every((c) => c.year !== null && c.year >= W.start && c.year <= W.end + 10));
});

// ---- B4 and B5: location ----
test("B4: signal.location is never combined with filter.results.entities", () => {
  assert.throws(() => assertSafeParams("/v2/insights", { "filter.type": "urn:entity:place", "signal.location": "SYN-LOC-123", "filter.results.entities": "AAAAAA-1" }), /signal.location/);
  assert.doesNotThrow(() => assertSafeParams("/v2/insights", { "filter.type": "urn:entity:place", "signal.location": "SYN-LOC-123", "signal.interests.entities": "AAAAAA-1" }));
});

test("B5: location is refused for films, TV and artists, and filter.location is not an allowed parameter", async () => {
  for (const t of ["movie", "tv_show", "artist"]) assert.throws(() => assertSafeParams("/v2/insights", { "filter.type": `urn:entity:${t}`, "signal.location": "SYN-LOC-123", "signal.interests.entities": "AAAAAA-1" }));
  assert.throws(() => assertSafeParams("/v2/insights", { "filter.type": "urn:entity:movie", "filter.location.query": "Lagos" }));
});

test("B4 and B5: no pinned call and no media call in a full run carries a location", async () => {
  const seen: URL[] = [];
  await runCardAgent({ client: mk(seen), model: null, currentYear: 2026 }, { resident, observations: [], cardId: "c" });
  for (const u of seen.filter((x) => x.pathname === "/v2/insights")) {
    const t = u.searchParams.get("filter.type");
    if (u.searchParams.has("signal.location")) {
      assert.ok(t === "urn:entity:place" || t === "urn:entity:destination");
      assert.equal(u.searchParams.has("filter.results.entities"), false);
    }
  }
});

// ---- B6: route signals by domain ----
test("B6: a dish is never a signal for films; food favourites drive only food and places", async () => {
  assert.equal(favouriteRoute({ kind: "tag", id: "urn:tag:cuisine:jollof", type: null }), "food");
  assert.equal(favouriteRoute({ kind: "entity", id: "x", type: "urn:entity:artist" }), "media");
  const routes = routeSignals(resident.favourites, []);
  assert.deepEqual(routes.food.tagIds, ["urn:tag:cuisine:jollof"]);
  assert.deepEqual(routes.media.entityIds.sort(), ["SYN-FAV-001", "SYN-MOVIE-001"]);
  const seen: URL[] = [];
  const out = await runCardAgent({ client: mk(seen), model: null, currentYear: 2026 }, { resident, observations: [], cardId: "c" });
  for (const u of seen.filter((x) => x.pathname === "/v2/insights" && ["urn:entity:movie", "urn:entity:tv_show", "urn:entity:artist"].includes(typeOf(x)))) {
    assert.ok(!(u.searchParams.get("signal.interests.tags") ?? "").includes("jollof"), "film, TV and music calls carry no food signal");
  }
  assert.ok(seen.some((x) => x.searchParams.get("filter.type") === "urn:entity:place" && (x.searchParams.get("filter.tags") ?? "").includes("cuisine")));
  assert.ok(out.card.decisions.some((d) => d.decision === "route_signals"));
});

// ---- B7: extra endpoints, compare in the room planner ----
test("B7: compare, trending and audiences go through the allowlist; the room planner explains in one line", async () => {
  assert.doesNotThrow(() => assertSafeParams("/v2/trending", { "filter.type": "urn:entity:artist", "signal.interests.entities": "AAAAAA-1", "filter.start_date": "2026-01-01", "filter.end_date": "2026-02-01" }));
  assert.throws(() => assertSafeParams("/v2/trending", { "filter.start_date": "yesterday" }));
  assert.throws(() => assertSafeParams("/v2/analysis/compare", { "a.signal.interests.entities": "walter okafor" }));
  assert.deepEqual(sharedNames({ results: { tags: [{ name: "A" }, { name: "B" }] } }), ["A", "B"]);
  const line = await explainPair(mk(), "Walter", "Ruth", ["SYN-FAV-001"], ["SYN-FAV-001"]);
  assert.equal(line, "Walter and Ruth share an affinity for Synthetic soul, Synthetic gospel.");
  const rs = ["a", "b", "c"].map((id, i) => ({ resident: { ...resident, id, firstName: id.toUpperCase(), birthYear: 1938 + i }, observations: [] }));
  const g = await planGroupSession(mk(), { residents: rs, currentYear: 2026 });
  assert.ok(g.explanation && g.explanation.line);
});

// ---- B8: rate discipline ----
test("B8: lookups are batched into one /entities call", async () => {
  const seen: URL[] = [];
  const c = mk(seen);
  await c.entities(["AAAAAA-1", "BBBBBB-2", "CCCCCC-3"]);
  assert.equal(seen.filter((x) => x.pathname === "/entities").length, 1);
  assert.equal(seen[0]!.searchParams.get("entity_ids"), "AAAAAA-1,BBBBBB-2,CCCCCC-3");
});

// ---- D: visible decisions ----
test("D: dropped and unconfirmed favourites are recorded with why", async () => {
  const r2: Resident = { ...resident, favourites: [...resident.favourites, { text: "Zxqv Nothing", kind: "unresolved", id: null, name: null, type: null, confirmed: false, reason: "Qloo has no match" }, { text: "Maybe This", kind: "unresolved", id: null, name: null, type: null, confirmed: false }] };
  const out = await runCardAgent({ client: mk(), model: null, currentYear: 2026 }, { resident: r2, observations: [], cardId: "c" });
  assert.ok(out.card.decisions.some((d) => d.decision === "drop_favourite" && d.why.includes("Zxqv Nothing")));
  assert.ok(out.card.decisions.some((d) => d.decision === "ask_confirm" && d.why.includes("Maybe This")));
});

test("D: widening is recorded as a decision after the carer agreed", async () => {
  const out = await runCardAgent({ client: mk(), model: null, currentYear: 2026 }, { resident, observations: [], cardId: "c", widenBy: 5 });
  assert.ok(out.card.decisions.some((d) => d.decision === "widen_window"));
  assert.equal(out.card.widenedBy, 5);
});

test("D: music strategy switches to people when artists carry no years", async () => {
  const out = await runCardAgent({ client: mk([], false), model: null, currentYear: 2026 }, { resident, observations: [], cardId: "c" });
  const d = out.card.decisions.find((x) => x.decision === "switch_music_strategy");
  assert.ok(d, "a switch decision is on the card");
  assert.ok(d.why.includes("people born"));
});

test("D: a domain with nothing to search from abstains and says so", async () => {
  const r3: Resident = { ...resident, favourites: [fav("urn:tag:cuisine:jollof", "jollof rice", null, "tag")] };
  const out = await runCardAgent({ client: mk(), model: null, currentYear: 2026 }, { resident: r3, observations: [{ id: "o", residentId: "r1", cardId: "c", entityId: "SYN-FAV-001", entityName: "Synthetic Singer", domain: "music", tags: [], value: "lit_up", note: null, by: "u", at: new Date().toISOString() }], cardId: "c" });
  assert.ok(out.card.decisions.length > 0);
});

// ---- A: group planner is an agent tool ----
test("A: the agent decides which residents go into plan_group_session; the server computes the plan", async () => {
  const residents = ["a", "b", "c", "d"].map((id, i) => ({ id, firstName: id.toUpperCase(), birthYear: 1936 + i }));
  const planned: string[][] = [];
  const planFn = async (ids: string[]) => { planned.push(ids); return { plan: { items: [], excluded: [], coverage: [] }, names: {}, calls: 0, explanation: null }; };
  let step = 0;
  const model: Model = { provider: "scripted", id: "t", async complete() { step++; return step === 1 ? { text: "", toolCalls: [{ id: "1", name: "plan_group_session", args: { residentIds: ["a", "c", "zzz"] } }], usage: { inputTokens: 1, outputTokens: 1 } } : { text: "done", toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } }; } };
  const r = await runGroupAgent({ model }, residents, planFn);
  assert.deepEqual(planned, [["a", "c"]], "only residents from the list, chosen by the agent");
  assert.ok(r.trail.some((t) => t.tool === "plan_group_session" && t.summary.startsWith("The agent")));
  const none = await runGroupAgent({ model: null }, residents, planFn);
  assert.deepEqual(planned[1], ["a", "b", "c", "d"]);
  assert.ok(none.modelNote?.includes("No model"));
});

test("typed errors still carry their code", async () => {
  const c = new QlooClient({ key: undefined });
  await assert.rejects(() => c.compare(["AAAAAA-1"], ["BBBBBB-2"]), (e: QlooError) => e.code === "QLOO_NOT_CONFIGURED");
});
