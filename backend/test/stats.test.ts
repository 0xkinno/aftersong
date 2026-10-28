import test from "node:test";
import assert from "node:assert/strict";
import { binomialTwoSided, kendallTau, signTest } from "../src/stats.ts";

test("exact binomial: known values", () => {
  assert.ok(Math.abs(binomialTwoSided(10, 9) - 0.021484375) < 1e-9);
  assert.ok(Math.abs(binomialTwoSided(10, 5) - 1) < 1e-9);
  assert.ok(Math.abs(binomialTwoSided(15, 15) - 2 / 32768) < 1e-12);
  assert.equal(binomialTwoSided(0, 0), 1);
});

test("sign test drops ties, reports plain verdicts", () => {
  const s = signTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0]);
  assert.equal(s.n, 9);
  assert.equal(s.ties, 2);
  assert.ok(s.p !== null && s.p < 0.01);
  assert.equal(s.verdict, "significant at 0.05");
  assert.equal(signTest([1, -1, 1, -1]).verdict, "not significant at 0.05");
  assert.equal(signTest([0, 0]).verdict, "no usable pairs");
});

test("kendall tau: identical, reversed, partial", () => {
  assert.equal(kendallTau(["a", "b", "c", "d"], ["a", "b", "c", "d"]), 1);
  assert.equal(kendallTau(["a", "b", "c", "d"], ["d", "c", "b", "a"]), -1);
  assert.equal(kendallTau(["a", "b", "c"], ["x", "y"]), null);
  assert.equal(kendallTau(["a", "b", "c", "d"], ["a", "c", "b", "d"]), 0.667);
});
