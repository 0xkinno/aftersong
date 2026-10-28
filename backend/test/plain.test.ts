import test from "node:test";
import assert from "node:assert/strict";
import type { Model } from "../src/agent/model.ts";
import { parsePlainList, runPlainAi } from "../src/agent/plain.ts";
import { QlooClient, type Transport } from "../src/qloo/client.ts";
import type { Resident } from "../src/store/types.ts";

// SYNTHETIC. A tiny Qloo stand-in that knows two things: one inside the window, one outside.
const transport: Transport = async (url) => {
  const p = url.searchParams;
  const ok = (b: unknown) => ({ status: 200, headers: { get: () => null }, json: async () => b });
  if (url.pathname === "/search") {
    const q = p.get("query") ?? "";
    if (q === "Synthetic Inside") return ok({ results: [{ entity_id: "SYN-IN-0001", name: "Synthetic Inside", type: "urn:entity:movie" }] });
    if (q === "Synthetic Outside") return ok({ results: [{ entity_id: "SYN-OUT-0001", name: "Synthetic Outside", type: "urn:entity:movie" }] });
    return ok({ results: [] });
  }
  if (url.pathname === "/entities") {
    const ids = (p.get("entity_ids") ?? "").split(",");
    return ok({ results: ids.map((id) => ({ entity_id: id, name: id === "SYN-IN-0001" ? "Synthetic Inside" : "Synthetic Outside", type: "urn:entity:movie", popularity: 0.4, properties: { release_year: id === "SYN-IN-0001" ? 1960 : 2005 } })) });
  }
  if (url.pathname === "/v2/insights") {
    const only = p.get("filter.results.entities");
    return ok({ results: { entities: [{ entity_id: only, name: "x", type: "urn:entity:movie", query: { affinity: 0.7 } }] } });
  }
  return { status: 404, headers: { get: () => null }, json: async () => ({}) };
};

const resident: Resident = { id: "r", homeId: "h", firstName: "S", birthYear: 1940, careCity: "A", hometown: "B", favourites: [{ text: "F", kind: "entity", id: "SYN-FAV-0001", name: "Synthetic Fav", type: null, confirmed: true }], offsets: { from: 10, to: 30 }, consent: true, consentRecord: null, intakeBy: "carer", familySubmittedAt: null, isSample: true, createdAt: "", updatedAt: "" };
const model = (text: string): Model => ({ provider: "scripted", id: "t", async complete() { return { text, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } }; } });

test("plain AI list: each item is looked up and held to the same rules", async () => {
  const text = `Here you go: [{"name":"Synthetic Inside","domain":"film","year":1960},{"name":"Synthetic Outside","domain":"film","year":1960},{"name":"Made Up Thing","domain":"music","year":1955}]`;
  const r = await runPlainAi({ client: new QlooClient({ key: "k", transport, spacingMs: 0 }), model: model(text) }, resident, { start: 1950, end: 1970 });
  assert.equal(r.summary.total, 3);
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  assert.equal(by["Synthetic Inside"]!.passes, true);
  assert.ok(by["Synthetic Outside"]!.failures.includes("outside_window"));
  assert.ok(by["Made Up Thing"]!.failures.includes("not_qloo_entity"));
  assert.equal(r.summary.passing, 1);
  assert.equal(r.summary.outsideWindow, 1);
  assert.equal(r.summary.notInQloo, 1);
});

test("plain AI parser ignores junk and unknown domains", () => {
  assert.deepEqual(parsePlainList("no json here"), []);
  assert.equal(parsePlainList('[{"name":"A","domain":"opera"},{"name":"B","domain":"tv"}]').length, 1);
});
