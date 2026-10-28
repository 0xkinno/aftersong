import test from "node:test";
import assert from "node:assert/strict";
import { QlooClient, QlooError, type Transport } from "../src/qloo/client.ts";
import { assertSafeParams } from "../src/qloo/guard.ts";

const ok = (body: unknown): Transport => async () => ({ status: 200, headers: { get: () => null }, json: async () => body });

test("spaces live calls by at least 250 ms and caches repeats", async () => {
  let t = 1000;
  const sleeps: number[] = [];
  const c = new QlooClient({
    key: "k",
    transport: ok({ results: { entities: [{ entity_id: "SYN-0001-AAAA", name: "Synthetic One" }] } }),
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
  });
  await c.insights({ "filter.type": "urn:entity:movie", "signal.interests.entities": "SYN-0001-AAAA" });
  await c.insights({ "filter.type": "urn:entity:movie", "signal.interests.entities": "SYN-0002-AAAA" });
  const again = await c.insights({ "filter.type": "urn:entity:movie", "signal.interests.entities": "SYN-0001-AAAA" });
  assert.equal(again.entities.length, 1);
  assert.equal(c.liveCallsToday(), 2);
  assert.ok(sleeps.some((s) => s >= 250 - 1));
});

test("429 is not retried and surfaces a typed error", async () => {
  let n = 0;
  const c = new QlooClient({ key: "k", spacingMs: 0, transport: async () => (n++, { status: 429, headers: { get: () => null }, json: async () => ({}) }) });
  await assert.rejects(() => c.insights({ "filter.type": "urn:entity:movie" }), (e: QlooError) => e.code === "QLOO_RATE_LIMIT");
  assert.equal(n, 1);
});

test("missing key is reported, not hidden", async () => {
  const c = new QlooClient({ key: undefined });
  await assert.rejects(() => c.search("Sam Cooke"), (e: QlooError) => e.code === "QLOO_NOT_CONFIGURED");
});

test("daily cap stops live calls", async () => {
  const c = new QlooClient({ key: "k", spacingMs: 0, dailyCap: 1, transport: ok({ results: [] }) });
  await c.search("a");
  await assert.rejects(() => c.search("b"), (e: QlooError) => e.code === "QLOO_DAILY_CAP");
});

test("guard blocks personal data and unknown parameters", () => {
  assert.throws(() => assertSafeParams("/v2/insights", { "signal.interests.entities": "walter okafor" }));
  assert.throws(() => assertSafeParams("/v2/insights", { "signal.demographics.gender": "male" }));
  assert.throws(() => assertSafeParams("/search", { query: "someone@example.com" }));
  assert.throws(() => assertSafeParams("/v2/other", {}));
  assert.doesNotThrow(() => assertSafeParams("/v2/insights", { "filter.type": "urn:entity:movie", "filter.release_year.min": 1952, "filter.release_year.max": 1972, "signal.demographics.age": "55_and_older" }));
});

test("identical in-flight requests share one live call", async () => {
  let n = 0;
  const c = new QlooClient({
    key: "k",
    spacingMs: 0,
    transport: async () => {
      n++;
      await new Promise((r) => setTimeout(r, 20));
      return { status: 200, headers: { get: () => null }, json: async () => ({ results: [] }) };
    },
  });
  await Promise.all([c.search("same"), c.search("same")]);
  assert.equal(n, 1);
});
