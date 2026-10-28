import test from "node:test";
import assert from "node:assert/strict";
import { Limiter, limitConfigFromEnv } from "../src/limits.ts";
import { QlooClient } from "../src/qloo/client.ts";
import { HttpError, Service, type Actor } from "../src/service.ts";
import { FileStore } from "../src/store/store.ts";
import { mockQloo } from "./mock-qloo.ts";

function make() {
  const store = new FileStore(null);
  const client = new QlooClient({ key: "k", transport: mockQloo, spacingMs: 0 });
  const svc = new Service({ store, client, model: null, limiter: new Limiter(limitConfigFromEnv({})), sabotage: "none", samplesPath: "none" });
  return { store, svc };
}
const carer: Actor = { role: "carer", userId: "u1", homeId: "home-a" };
const input = { firstName: "Sample", birthYear: 1940, careCity: "San Antonio, Texas", hometown: "Port Harcourt, Nigeria", favouriteTexts: ["Synthetic Singer"], consent: true, by: "family" as const };

test("roles: family writes the intake, carer confirms and logs; neither can do the other's job", async () => {
  const { svc } = make();
  const r = await svc.createResident("home-a", input);
  const token = await svc.createFamilyLink(carer, r.id);
  const fam = await svc.familyActor(token);

  await assert.rejects(() => svc.saveIntake(carer, r.id, { hometown: "Elsewhere" }), (e: HttpError) => e.status === 403);
  await assert.rejects(() => svc.saveIntake(fam, r.id, { hometown: "Elsewhere", favouriteTexts: ["Synthetic Singer"] }), (e: HttpError) => e.status === 400, "no consent, nothing saved");
  assert.equal((await svc.getResident(fam, r.id)).hometown, "Port Harcourt, Nigeria");
  const saved = await svc.saveIntake(fam, r.id, { hometown: "Port Harcourt, Nigeria", favouriteTexts: ["Synthetic Singer", "Another"], consent: true });
  assert.equal(saved.consentRecord?.givenBy, "family");
  assert.ok(saved.consentRecord && Date.parse(saved.consentRecord.at) > 0, "consent is stored with a timestamp");
  await assert.rejects(() => svc.confirm(fam, r.id, "Synthetic Singer", null), (e: HttpError) => e.status === 403);

  const items = await svc.resolveForCarer(carer, r.id);
  const pick = items[0]!.resolution!.matches[0]!;
  await svc.confirm(carer, r.id, "Synthetic Singer", { id: pick.id, name: pick.name, type: pick.type, kind: pick.kind });

  const { card } = await svc.buildCard(r.id, { actor: carer });
  assert.ok(card.items.length >= 6);
  await assert.rejects(() => svc.logObservation(fam, card.id, card.items[0]!.entityId, "lit_up", null), (e: HttpError) => e.status === 403);
  const o = await svc.logObservation(carer, card.id, card.items[0]!.entityId, "lit_up", "sang the chorus");
  await assert.rejects(() => svc.logObservation(carer, card.id, "not-on-card", "lit_up", null), (e: HttpError) => e.status === 400);

  const view = await svc.familyView(fam);
  assert.equal(view.memory.length, 1);
  assert.deepEqual(view.works, [card.items[0]!.name]);
  await svc.deleteObservation(fam, r.id, o.id);
  assert.equal((await svc.familyView(fam)).memory.length, 0);

  const other: Actor = { role: "carer", userId: "u2", homeId: "home-b" };
  await assert.rejects(() => svc.getResident(other, r.id), (e: HttpError) => e.status === 404);
  await assert.rejects(() => svc.familyActor("not-a-token"), (e: HttpError) => e.status === 404);
});

test("the next card walks outward from what lit up and drops what upset", async () => {
  const { svc } = make();
  const r = await svc.createResident("home-a", { ...input, by: "carer" });
  const items = await svc.resolveForCarer(carer, r.id);
  const m = items[0]!.resolution!.matches[0]!;
  await svc.confirm(carer, r.id, "Synthetic Singer", { id: m.id, name: m.name, type: m.type, kind: m.kind });
  const first = (await svc.buildCard(r.id, { actor: carer })).card;
  await svc.logObservation(carer, first.id, first.items[0]!.entityId, "upset", null);
  await svc.logObservation(carer, first.id, first.items[1]!.entityId, "lit_up", null);
  const second = (await svc.buildCard(r.id, { actor: carer })).card;
  assert.ok(!second.items.some((i) => i.entityId === first.items[0]!.entityId), "upset item is gone");
  assert.ok(second.items.some((i) => i.connectedTo.kind === "observation" && i.walk), "a later item shows its walk");
});

test("session progress persists so a carer can pause and resume", async () => {
  const { svc } = make();
  const r = await svc.createResident("home-a", { ...input, by: "carer" });
  const m = (await svc.resolveForCarer(carer, r.id))[0]!.resolution!.matches[0]!;
  await svc.confirm(carer, r.id, "Synthetic Singer", { id: m.id, name: m.name, type: m.type, kind: m.kind });
  const { card } = await svc.buildCard(r.id, { actor: carer });
  await svc.saveSession(carer, card.id, { currentIndex: 3 });
  assert.equal((await svc.getSession(carer, card.id))!.currentIndex, 3);
});

test("weekly digest runs without being asked and is created once", async () => {
  const { svc } = make();
  const r = await svc.createResident("home-a", { ...input, by: "carer" });
  const m = (await svc.resolveForCarer(carer, r.id))[0]!.resolution!.matches[0]!;
  await svc.confirm(carer, r.id, "Synthetic Singer", { id: m.id, name: m.name, type: m.type, kind: m.kind });
  const { card } = await svc.buildCard(r.id, { actor: carer });
  await svc.logObservation(carer, card.id, card.items[0]!.entityId, "sang_or_moved", null);
  const a = await svc.runDigests("scheduler");
  const b = await svc.runDigests("scheduler");
  assert.equal(a.created, 1);
  assert.equal(b.created, 0);
  assert.equal(b.skipped, 1);
});

test("life story PDF is built from confirmed data only and is a PDF", async () => {
  const { svc } = make();
  const r = await svc.createResident("home-a", { ...input, by: "carer" });
  const pdf = await svc.lifeStory(carer, r.id);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.toString("latin1").includes("None confirmed yet"));
});

test("public lock: per-visitor cap and kill switch say why", () => {
  const l = new Limiter(limitConfigFromEnv({ PER_VISITOR_PER_DAY: "2" }));
  assert.equal(l.take("1.1.1.1").ok, true);
  assert.equal(l.take("1.1.1.1").ok, true);
  const third = l.take("1.1.1.1");
  assert.equal(third.ok, false);
  assert.equal(l.take("2.2.2.2").ok, true);
  const k = new Limiter(limitConfigFromEnv({ KILL_SWITCH: "on" }));
  assert.equal(k.take("x").ok, false);
});

test("intake validation rejects contact details and out of range years", async () => {
  const { svc } = make();
  await assert.rejects(() => svc.createResident("h", { ...input, favouriteTexts: ["call me on 5551234567"] }), (e: HttpError) => e.status === 400);
  await assert.rejects(() => svc.createResident("h", { ...input, birthYear: 2015 }), (e: HttpError) => e.status === 400);
  await assert.rejects(() => svc.createResident("h", { ...input, consent: false }), (e: HttpError) => e.status === 400);
});

test("consent is recorded with a timestamp when a carer creates the resident, and nothing is saved without it", async () => {
  const { svc, store } = make();
  const r = await svc.createResident("home-a", { ...input, by: "carer", consentBy: "resident" });
  assert.equal(r.consentRecord?.givenBy, "resident");
  assert.equal(r.consentRecord?.recordedBy, "carer");
  assert.ok(Date.parse(r.consentRecord!.at) > 0);
  const before = (await store.list("residents")).length;
  await assert.rejects(() => svc.createResident("home-a", { ...input, consent: false }), (e: HttpError) => e.status === 400);
  assert.equal((await store.list("residents")).length, before);
});

test("the weekly family note lists items to avoid by name and uses only logged reactions", async () => {
  const { svc } = make();
  const r = await svc.createResident("home-a", { ...input, by: "carer" });
  const m = (await svc.resolveForCarer(carer, r.id))[0]!.resolution!.matches[0]!;
  await svc.confirm(carer, r.id, "Synthetic Singer", { id: m.id, name: m.name, type: m.type, kind: m.kind });
  const { card } = await svc.buildCard(r.id, { actor: carer });
  await svc.logObservation(carer, card.id, card.items[0]!.entityId, "upset", null);
  await svc.logObservation(carer, card.id, card.items[1]!.entityId, "lit_up", null);
  const obs = (await svc.timeline(carer, r.id)).observations;
  const d = svc.buildDigest(r, obs, "2026-W44", "manual", new Date().toISOString());
  assert.ok(d.lines.some((l) => l.startsWith("Stays off the cards:") && l.includes(card.items[0]!.name)));
  assert.ok(d.lines.some((l) => l.startsWith("What worked:") && l.includes(card.items[1]!.name)));
  assert.ok(!d.lines.some((l) => l.includes(card.items[2]!.name)), "an item nobody reacted to is not mentioned");
});
