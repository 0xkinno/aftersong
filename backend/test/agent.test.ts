import test from "node:test";
import assert from "node:assert/strict";
import { NeedsConfirmation, runCardAgent } from "../src/agent/agent.ts";
import type { Model } from "../src/agent/model.ts";
import { scripted } from "./scripted-model.ts";
import { QlooClient } from "../src/qloo/client.ts";
import { verifyCard } from "../src/core/verify.ts";
import type { Resident } from "../src/store/types.ts";
import { mockQloo } from "./mock-qloo.ts";

const resident: Resident = {
  id: "r1", homeId: "h1", firstName: "Sample", birthYear: 1940, careCity: "San Antonio, Texas", hometown: "Port Harcourt, Nigeria",
  favourites: [{ text: "Synthetic Singer", kind: "entity", id: "SYN-FAV-001", name: "Synthetic Singer", type: "urn:entity:artist", confirmed: true }],
  offsets: { from: 10, to: 30 }, consent: true, intakeBy: "family", familySubmittedAt: null, isSample: true, createdAt: "", updatedAt: "",
};

const client = () => new QlooClient({ key: "k", transport: mockQloo, spacingMs: 0 });

test("agent: tools run in order, card is built under rules, model openers accepted, verifier passes", async () => {
  const r = await runCardAgent({ client: client(), model: scripted(), currentYear: 2026 }, { resident, observations: [], cardId: "c1" });
  assert.equal(r.card.status, "ok");
  assert.ok(r.card.items.length >= 6);
  assert.ok(r.card.items.every((i) => i.opener.source === "model"), JSON.stringify(r.card.items.map((i) => i.opener)));
  assert.deepEqual(r.card.trail.map((t) => t.tool).slice(0, 2), ["resolve_favourites", "find_era_items"]);
  const v = verifyCard(r.card, { ...r.evidence, birthYear: 1940, offsets: resident.offsets, currentYear: 2026, allowedNames: ["Port Harcourt", "San Antonio"] });
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter((c) => !c.ok)));
  assert.ok(r.card.items.some((i) => i.domain === "music"), "music passes through the decade tag era");
});

test("fault switch: a model that injects an off-card name and entity is blocked by invariant 5", async () => {
  const r = await runCardAgent({ client: client(), model: scripted(), sabotage: "model_injects", currentYear: 2026 }, { resident, observations: [], cardId: "c2" });
  const first = r.card.items[0]!;
  assert.equal(first.opener.source, "template");
  assert.ok(first.opener.blocked?.some((b) => b.startsWith("names_off_card")));
  assert.ok(!r.card.items.some((i) => i.entityId === "off-card-entity"));
  const v = verifyCard(r.card, { ...r.evidence, birthYear: 1940, offsets: resident.offsets, currentYear: 2026, allowedNames: ["Port Harcourt", "San Antonio"] });
  assert.equal(v.ok, true);
});

test("no model: card is built in fixed order, labelled, never silent", async () => {
  const r = await runCardAgent({ client: client(), model: null, currentYear: 2026 }, { resident, observations: [], cardId: "c3" });
  assert.equal(r.card.model, null);
  assert.ok(r.modelNote?.includes("No model"));
  assert.ok(r.card.items.every((i) => i.opener.source === "template"));
});

test("model failure mid-run falls back and says so", async () => {
  const failing: Model = { provider: "x", id: "y", async complete() { throw new Error("boom"); } };
  const r = await runCardAgent({ client: client(), model: failing, currentYear: 2026 }, { resident, observations: [], cardId: "c4" });
  assert.ok(r.modelNote?.includes("unavailable"));
  assert.ok(r.card.items.length > 0);
});

test("no confirmed favourite: the agent stops and says the carer must confirm", async () => {
  const none: Resident = { ...resident, favourites: [{ ...resident.favourites[0]!, confirmed: false }] };
  await assert.rejects(() => runCardAgent({ client: client(), model: null, currentYear: 2026 }, { resident: none, observations: [], cardId: "c5" }), NeedsConfirmation);
});
