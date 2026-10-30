import test from "node:test";
import assert from "node:assert/strict";
import { buildCard } from "../src/core/card.ts";
import { labelFor, popularityCeiling } from "../src/core/classify.ts";
import { houseStyleViolations, claimViolations } from "../src/core/house-style.ts";
import { memorySignals, neighbourWeight, type Observation } from "../src/core/memory.ts";
import { openerViolations, settleOpener } from "../src/core/openers.ts";
import { planRoom } from "../src/core/room.ts";
import { verifyCard, type Evidence } from "../src/core/verify.ts";
import { bumpWindow } from "../src/core/window.ts";
import type { Candidate } from "../src/core/types.ts";
import { cand, fav } from "./fixtures.ts";

const W = bumpWindow(1940, undefined, 0, 2026);

test("bump window is birth year plus 10 to 30 and can widen", () => {
  assert.deepEqual(W, { start: 1950, end: 1970 });
  assert.deepEqual(bumpWindow(1940, undefined, 5, 2026), { start: 1945, end: 1975 });
  assert.throws(() => bumpWindow(1940, { from: 2, to: 30 }));
});

function pools(extra: Candidate[] = []) {
  const mk = (domain: "music" | "film" | "tv" | "food" | "place", n: number) =>
    Array.from({ length: n }, (_, i) => cand({ id: `SYN-${domain}-${i}`, name: `Synthetic ${domain} ${i}`, domain, year: domain === "food" || domain === "place" ? null : 1955 + i, personalAffinity: 0.9 - i * 0.05, personalRank: i + 1 }));
  return { music: [...mk("music", 5), ...extra.filter((c) => c.domain === "music")], film: mk("film", 4), tv: mk("tv", 3), food: mk("food", 2), place: mk("place", 2) };
}
const seen = (p: ReturnType<typeof pools>) => new Set(Object.values(p).flat().map((c) => c.id));
const noMemory: import("../src/core/memory.ts").MemorySignals = { positive: [], upset: [], expired: [] };

function build(p = pools(), memory = noMemory, favs = [fav("SYN-FAV-001", "Synthetic Singer")]) {
  return buildCard({ cardId: "c1", residentId: "r1", window: W, widenedBy: 0, favourites: favs, memory, pools: p, seenIds: seen(p), model: null, trail: [], calls: [], now: "2026-10-28T00:00:00Z" });
}

test("card has 6 to 8 items, quotas respected, status ok", () => {
  const card = build();
  assert.equal(card.status, "ok");
  assert.ok(card.items.length >= 6 && card.items.length <= 8);
  assert.equal(card.items.filter((i) => i.domain === "music").length, 3);
});

test("items outside the window or without a year are rejected with reasons", () => {
  const p = pools([cand({ id: "SYN-late", name: "Synthetic Late", domain: "music", year: 1999, personalAffinity: 0.99 }), cand({ id: "SYN-noyear", name: "Synthetic Noyear", domain: "music", year: null, personalAffinity: 0.98 })]);
  const card = build(p);
  assert.ok(!card.items.some((i) => i.entityId === "SYN-late" || i.entityId === "SYN-noyear"));
  const rules = card.rejections.map((r) => `${r.entityId}:${r.failures.map((f) => f.rule).join("+")}`);
  assert.ok(rules.includes("SYN-late:outside_window"));
  assert.ok(rules.includes("SYN-noyear:era_unknown"));
});

test("an item not scored against a confirmed signal is rejected as not connected", () => {
  const p = pools([cand({ id: "SYN-stray", name: "Synthetic Stray", domain: "music", signalIds: ["SYN-OTHER"], personalAffinity: 0.99 })]);
  const card = build(p);
  assert.ok(!card.items.some((i) => i.entityId === "SYN-stray"));
  assert.ok(card.rejections.some((r) => r.entityId === "SYN-stray" && r.failures.some((f) => f.rule === "not_connected")));
});

test("the confirmed favourite itself is never recommended; an entity Qloo did not return is refused", () => {
  const p = pools([cand({ id: "SYN-FAV-001", name: "Synthetic Singer", domain: "music" })]);
  const card = build(p);
  assert.ok(card.rejections.some((r) => r.entityId === "SYN-FAV-001" && r.failures.some((f) => f.rule === "is_seed")));
  const p2 = pools();
  const c = buildCard({ cardId: "c", residentId: "r", window: W, widenedBy: 0, favourites: [fav("SYN-FAV-001", "S")], memory: noMemory, pools: p2, seenIds: new Set(), model: null, trail: [], calls: [] });
  assert.equal(c.items.length, 0);
  assert.ok(c.rejections.every((r) => r.failures.some((f) => f.rule === "not_qloo_entity")));
});

const obs = (p: Partial<Observation> & { entityId: string; value: Observation["value"] }): Observation => ({ id: "o", residentId: "r1", cardId: "c0", entityName: "N", domain: "music", tags: [], note: null, by: "carer", at: "2026-10-20T00:00:00Z", ...p });

test("upset suppresses the item and an earlier positive becomes a signal with a walk", () => {
  const mem = memorySignals([obs({ entityId: "SYN-music-0", value: "upset", entityName: "Synthetic music 0" }), obs({ entityId: "SYN-OBS-1", value: "lit_up", entityName: "Synthetic Hit" })], Date.parse("2026-10-28"));
  const p = pools([cand({ id: "SYN-walk", name: "Synthetic Walk", domain: "music", signalIds: ["SYN-OBS-1"], personalAffinity: 0.95, personalRank: 1 })]);
  const card = build(p, mem);
  assert.ok(!card.items.some((i) => i.entityId === "SYN-music-0"));
  const walk = card.items.find((i) => i.entityId === "SYN-walk");
  assert.ok(walk, "walk item present");
  assert.equal(walk.connectedTo.kind, "observation");
  assert.equal(walk.walk?.fromObservation, "lit_up");
});

test("memory expires after 90 days unless logged again; upset does not expire", () => {
  const now = Date.parse("2026-10-28");
  const old = "2026-06-01T00:00:00Z";
  const m = memorySignals([obs({ entityId: "A", value: "lit_up", at: old }), obs({ entityId: "B", value: "upset", at: old }), obs({ entityId: "C", value: "lit_up", at: old }), obs({ entityId: "C", value: "lit_up", at: "2026-10-01T00:00:00Z" })], now);
  assert.deepEqual(m.positive.map((o) => o.entityId), ["C"]);
  assert.deepEqual(m.upset.map((o) => o.entityId), ["B"]);
  assert.deepEqual(m.expired.map((o) => o.entityId), ["A"]);
});

test("neighbours of an upset item are down-weighted", () => {
  const tags = [{ id: "urn:tag:a", name: "a", type: null }, { id: "urn:tag:b", name: "b", type: null }];
  assert.equal(neighbourWeight(tags, [obs({ entityId: "X", value: "upset", tags })]), 0.5);
  assert.equal(neighbourWeight(tags.slice(0, 1), [obs({ entityId: "X", value: "upset", tags })]), 1);
});

test("labels compare ranks inside two calls over one pool, never raw affinities", () => {
  const r = (p: number | null, c: number | null, pop = 0.3, domain: "film" | "food" = "film") => ({ domain, popularity: pop, personalRank: p, cohortRank: c, personalN: 12, cohortN: 12 });
  assert.equal(labelFor(r(2, 10)).label, "personal"); // top third for him, bottom half for the cohort
  assert.equal(labelFor(r(2, 3)).label, "shared_era"); // top third for both
  assert.equal(labelFor(r(2, 6)).label, "overlap"); // middle band for the cohort
  assert.equal(labelFor(r(9, 2)).label, "overlap");
  assert.equal(labelFor(r(1, 12, 0.95)).label, "widely_known"); // popularity wins whatever the ranks
  assert.equal(labelFor(r(null, 3)).label, null); // no rank for him: abstain on the item
  const u = labelFor(r(2, null));
  assert.equal(u.cohortUnknown, true); // unknown is flagged, never zero
  assert.equal(labelFor(r(null, null, 0.3, "food")).label, "hometown");
});

test("thin result abstains and offers to widen", () => {
  const card = build({ music: pools().music.slice(0, 1), film: [], tv: [], food: [], place: [] });
  assert.equal(card.status, "thin");
  assert.ok(card.abstentions.some((a) => a.domain === "card" && a.canWiden));
});

const ctx = { allowedNames: ["Synthetic Singer", "Marisol", "Port Harcourt"], knownNames: ["Frank Sinatra", "Synthetic Singer"] };

test("openers: off-card names, medical claims, dashes and emoji are blocked", () => {
  assert.ok(openerViolations("Does this remind you of Frank Sinatra?", ctx).some((v) => v.startsWith("names_off_card")));
  assert.ok(openerViolations("This song will calm him down.", ctx).length > 0);
  assert.ok(openerViolations("A song — from back then?", ctx).includes("dash"));
  assert.ok(openerViolations("Do you remember this one? \u{1F600}", ctx).includes("emoji"));
  assert.ok(openerViolations("Does Synthetic Singer ring a bell from the fifties?", ctx).length === 0);
  assert.ok(openerViolations("Did you hear Nat King Cole on the radio?", ctx).some((v) => v.startsWith("names_off_card")));
});

test("a blocked model line is replaced by a labelled template line", () => {
  const o = settleOpener({ name: "Synthetic Singer", domain: "music", year: 1960 }, "Play Frank Sinatra next.", ctx);
  assert.equal(o.source, "template");
  assert.ok(o.blocked && o.blocked.length > 0);
});

test("house style and claims", () => {
  assert.deepEqual(houseStyleViolations("Plain and calm text."), []);
  assert.ok(houseStyleViolations("a seamless thing").includes("hype:seamless"));
  assert.ok(claimViolations("It will help his memory.").length > 0);
});

function evidenceFor(card: ReturnType<typeof build>): Evidence {
  return {
    birthYear: 1940,
    offsets: { from: 10, to: 30 },
    currentYear: 2026,
    confirmedIds: ["SYN-FAV-001"],
    positiveIds: [],
    upsetIds: [],
    entities: Object.fromEntries(card.items.map((i) => [i.entityId, { name: i.name, year: i.year, yearEnd: null }])),
    seenNames: ["Frank Sinatra", ...card.items.map((i) => i.name)],
    allowedNames: ["Walter", "Port Harcourt"],
    requests: [{ path: "/v2/insights", params: { "filter.type": "urn:entity:movie", "signal.interests.entities": "SYN-FAV-001" } }],
  };
}

test("offline verifier passes an honest card and fails each tampering", () => {
  const card = build();
  const ev = evidenceFor(card);
  { const r = verifyCard(card, ev); assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok))); }
  const t1 = structuredClone(card);
  t1.items[0]!.year = 1999;
  assert.equal(verifyCard(t1, ev).checks.find((c) => c.n === 2)!.ok, false);
  const t2 = structuredClone(card);
  t2.items[0]!.connectedTo.id = "SYN-NOT-CONFIRMED";
  assert.equal(verifyCard(t2, ev).checks.find((c) => c.n === 3)!.ok, false);
  const t3 = structuredClone(card);
  t3.items[0]!.opener.text = "Remember Frank Sinatra?";
  assert.equal(verifyCard(t3, ev).checks.find((c) => c.n === 5)!.ok, false);
  const t4 = verifyCard(card, { ...ev, upsetIds: [card.items[0]!.entityId] });
  assert.equal(t4.checks.find((c) => c.n === 4)!.ok, false);
  const t5 = verifyCard(card, { ...ev, requests: [{ path: "/v2/insights", params: { "signal.interests.entities": "walter okafor" } }] });
  assert.equal(t5.checks.find((c) => c.n === 6)!.ok, false);
  const t6 = structuredClone(card);
  t6.items[0]!.entityId = "SYN-MISSING";
  assert.equal(verifyCard(t6, ev).checks.find((c) => c.n === 1)!.ok, false);
});

test("room planner: maximin, veto, and per-resident coverage", () => {
  const w = { start: 1950, end: 1970 };
  const rs = ["a", "b", "c", "d"].map((id) => ({ id, firstName: id.toUpperCase(), window: w, upsetIds: new Set<string>() }));
  rs[1]!.upsetIds.add("X-veto");
  const mk = (id: string, ranks: Record<string, number>) => ({ id, name: id, domain: "music" as const, year: 1960, yearEnd: null, ranks, poolSize: { a: 10, b: 10, c: 10, d: 10 } });
  const plan = planRoom(rs, [
    mk("balanced", { a: 3, b: 3, c: 3, d: 3 }),
    mk("lopsided", { a: 1, b: 1, c: 1, d: 10 }),
    mk("X-veto", { a: 1, b: 1, c: 1, d: 1 }),
    mk("sparse", { a: 1 }),
  ], 2);
  assert.equal(plan.items[0]!.candidate.id, "balanced");
  assert.ok(plan.excluded.some((e) => e.id === "X-veto" && e.reason.includes("upset")));
  assert.ok(plan.excluded.some((e) => e.id === "sparse"));
  assert.equal(plan.coverage.length, 4);
});

test("Widely known is calibrated from the pool, because Qloo's popularity is a percentile (measured: 44 of 50 artists at 0.99 or above)", () => {
  const pops = [1, 1, 1, 1, 1, 1, 0.999, 0.998, 0.997, 0.995, 0.99, 0.985];
  assert.equal(popularityCeiling(pops), 1, "top quarter boundary");
  assert.equal(popularityCeiling([0.5, 0.6]), 0.85, "too small a pool: the floor");
  assert.equal(popularityCeiling([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.82]), 0.85, "never below the floor");
  const r = (pop: number) => ({ domain: "film" as const, popularity: pop, personalRank: 2, cohortRank: 10, personalN: 12, cohortN: 12, popCeiling: 1 });
  assert.equal(labelFor(r(0.995)).label, "personal", "0.995 is not widely known when the pool's ceiling is 1.0");
  assert.equal(labelFor(r(1)).label, "widely_known");
});

test("a model line that is too short or not about the item is replaced by the template line", () => {
  const item = { name: "Synthetic Singer", domain: "music" as const, year: 1960 };
  const short = settleOpener(item, "Synthetic Singer?", ctx);
  assert.equal(short.source, "template");
  assert.ok(short.blocked?.includes("too_short"));
  const other = settleOpener(item, "Did you ever hear Synthetic Film on the radio?", { ...ctx, allowedNames: [...ctx.allowedNames, "Synthetic Film"] });
  assert.ok(other.blocked?.includes("not_about_item"));
  assert.equal(settleOpener(item, "Does Synthetic Singer ring a bell from the fifties?", ctx).source, "model");
});
