import test from "node:test";
import assert from "node:assert/strict";
import { computeF1, computeF2, computeF3, computeF4, computeF5, discoverySentence } from "../src/matrix.ts";

const top = (pops: number[]) => pops.map((p, i) => ({ id: `s${i}`, popularity: p }));

test("F1: cohort-only more popular than own in most forms is significant and yields a sentence", () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ form: `c${i}`, domain: "film", cohortTop8: top([0.9, 0.9, 0.88, 0.7, 0.6, 0.5, 0.5, 0.4]), ownTop8: top([0.5, 0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.1]) }));
  const r = computeF1(rows);
  assert.equal(r.sign.n, 15);
  assert.equal(r.sign.positive, 15);
  assert.ok(r.sign.p !== null && r.sign.p < 0.001);
  assert.equal(r.supports, true);
  const s = discoverySentence(r);
  assert.ok(s.sentence?.startsWith("With only his generation as the signal, 3 of 8"));
  assert.equal(s.strongest, "F1");
});

test("F1: a null or negative result is reported as such and writes no sentence", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ form: `c${i}`, domain: "film", cohortTop8: top(i % 2 ? [0.9, 0.9, 0.9, 0.9] : [0.1, 0.1, 0.1, 0.1]), ownTop8: top(i % 2 ? [0.1, 0.1, 0.1, 0.1] : [0.9, 0.9, 0.9, 0.9]) }));
  const r = computeF1(rows);
  assert.equal(r.supports, false);
  assert.equal(r.sign.verdict, "not significant at 0.05");
  assert.deepEqual(discoverySentence(r), { sentence: null, strongest: null });
  assert.equal(computeF1([{ form: "x", domain: "film", cohortTop8: top([0.5]), ownTop8: top([0.5]) }]).skipped, 1);
});

test("F2: overlap with the union of cohort-only results", () => {
  const r = computeF2([{ form: "a", cardItems: ["1", "2", "3", "4"] }, { form: "b", cardItems: ["1", "9"] }, { form: "c", cardItems: [] }], new Set(["1", "2"]));
  assert.equal(r.forms, 2);
  assert.equal(r.totalInUnion, 3);
  assert.equal(r.meanOverlapPct, 50);
});

test("F3: rank stability with and without the music anchor", () => {
  const r = computeF3([{ form: "a", withoutMusic: ["x", "y", "z"], withMusic: ["x", "y", "z"] }, { form: "b", withoutMusic: ["x", "y", "z"], withMusic: ["z", "y", "x"] }, { form: "c", withoutMusic: ["x"], withMusic: ["x"] }]);
  assert.equal(r.forms, 2);
  assert.equal(r.meanTau, 0);
  assert.equal(r.formsChanged, 1);
  assert.equal(r.skipped, 1);
});

test("F4: counts films outside the requested window, undated items are not counted as violations", () => {
  const r = computeF4([{ form: "a", type: "movie", window: { start: 1950, end: 1970 }, years: [1950, 1960, 1971, null] }, { form: "b", type: "tv_show", window: { start: 1950, end: 1970 }, years: [1955, 1956] }]);
  assert.deepEqual(r.movie, { returned: 4, dated: 3, outside: 1, violationPct: 33.3 });
  assert.equal(r.tv_show!.outside, 0);
});

test("F5: share of returned places whose address is in the hometown region", () => {
  const r = computeF5([{ form: "a", hometownTokens: ["Lagos", "Nigeria"], careTokens: ["Houston"], addresses: ["12 Marina, Lagos, Nigeria", "5 Main St, Houston, TX", null, "Ikeja, Lagos"] }]);
  assert.equal(r.placesWithAddress, 3);
  assert.equal(r.noAddress, 1);
  assert.equal(r.inHometownPct, 66.7);
  assert.equal(r.inCareCityPct, 33.3);
});
