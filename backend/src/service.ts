// Application logic over the store. Two roles, kept apart: the family writes the intake and can
// view and delete memory; the carer confirms matches, builds cards and logs reactions. Neither
// can write the other's data.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { runCardAgent, type AgentResult, type Sabotage, type TrailEvent } from "./agent/agent.ts";
import { planGroupSession, type GroupResult } from "./agent/group.ts";
import { runGroupAgent, type GroupAgentResult } from "./agent/group-agent.ts";
import type { Model } from "./agent/model.ts";
import { runPlainAi, type PlainResult } from "./agent/plain.ts";
import { claimViolations, houseStyleViolations } from "./core/house-style.ts";
import { memorySignals, type Observation } from "./core/memory.ts";
import { OBSERVATION_VALUES, type Favourite, type ObservationValue, type SessionCard } from "./core/types.ts";
import { bumpWindow, DEFAULT_OFFSETS } from "./core/window.ts";
import type { Evidence } from "./core/verify.ts";
import type { Limiter } from "./limits.ts";
import type { QlooClient } from "./qloo/client.ts";
import { autoConfirm, resolveFavourite, type Resolution } from "./qloo/resolve.ts";
import { lifeStoryPdf, type LifeStory } from "./pdf.ts";
import type { Store } from "./store/store.ts";
import type { Digest, Resident, Session } from "./store/types.ts";

export type Actor = { role: "carer"; userId: string; homeId: string } | { role: "family"; residentId: string };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export interface Deps {
  store: Store;
  client: QlooClient;
  model: Model | null;
  limiter: Limiter;
  sabotage: Sabotage;
  samplesPath: string;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const isoWeek = (d: Date): string => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
};

export interface UsageRecord {
  id: string;
  kind: "card" | "plain" | "group";
  cardId: string | null;
  residentId: string | null;
  liveQlooCalls: number;
  cachedCalls: number;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  at: string;
  sample: boolean;
}

export class Service {
  d: Deps;
  constructor(d: Deps) {
    this.d = d;
  }

  // ---------- homes and residents ----------
  async ensureHome(userId: string): Promise<string> {
    const found = await this.d.store.get<{ homeId: string }>("members", userId);
    if (found) return found.homeId;
    const homeId = `home-${randomUUID().slice(0, 8)}`;
    await this.d.store.put("members", userId, { homeId, userId }, { homeId });
    return homeId;
  }

  async createResident(homeId: string, i: { firstName: string; birthYear: number; careCity: string; hometown: string; favouriteTexts: string[]; consent: boolean; consentBy?: "family" | "resident"; by: "family" | "carer"; offsets?: { from: number; to: number } }): Promise<Resident> {
    if (!i.consent) throw new HttpError(400, "Consent from the resident or their family is required. Nothing is saved without it.");
    this.checkText(i.firstName, "first name");
    this.validIntake(i);
    const now = new Date().toISOString();
    const r: Resident = {
      id: `res-${randomUUID().slice(0, 8)}`,
      homeId,
      firstName: i.firstName.trim().slice(0, 40),
      birthYear: i.birthYear,
      careCity: i.careCity.trim().slice(0, 80),
      hometown: i.hometown.trim().slice(0, 80),
      favourites: i.favouriteTexts.slice(0, 5).map((t) => ({ text: t.trim().slice(0, 80), kind: "unresolved", id: null, name: null, type: null, confirmed: false })),
      offsets: i.offsets ?? DEFAULT_OFFSETS,
      consent: true,
      consentRecord: { givenBy: i.consentBy ?? "family", recordedBy: i.by, at: now, version: 1 },
      intakeBy: i.by,
      familySubmittedAt: i.by === "family" ? now : null,
      isSample: false,
      createdAt: now,
      updatedAt: now,
    };
    bumpWindow(r.birthYear, r.offsets);
    await this.d.store.put("residents", r.id, r, { homeId, residentId: r.id });
    return r;
  }

  private validIntake(i: { birthYear: number; careCity?: string; hometown?: string; favouriteTexts?: string[] }) {
    if (!Number.isInteger(i.birthYear) || i.birthYear < 1900 || i.birthYear > new Date().getUTCFullYear() - 40) throw new HttpError(400, "Birth year is out of range.");
    for (const t of i.favouriteTexts ?? []) if (!t.trim() || t.length > 80 || /[@<>]/.test(t) || /\d{6,}/.test(t)) throw new HttpError(400, "A favourite must be a short name, with no contact details.");
    if ((i.favouriteTexts ?? []).length > 5) throw new HttpError(400, "At most five favourites.");
  }

  private checkText(t: string, label: string) {
    if (!t || t.trim().length === 0 || t.length > 80 || /[@<>]/.test(t)) throw new HttpError(400, `The ${label} is not valid.`);
  }

  async getResident(actor: Actor, id: string): Promise<Resident> {
    const r = await this.d.store.get<Resident>("residents", id);
    if (!r) throw new HttpError(404, "Resident not found.");
    if (actor.role === "carer" && r.homeId !== actor.homeId) throw new HttpError(404, "Resident not found.");
    if (actor.role === "family" && r.id !== actor.residentId) throw new HttpError(404, "Resident not found.");
    return r;
  }

  async listResidents(homeId: string): Promise<Resident[]> {
    return this.d.store.list<Resident>("residents", { homeId });
  }

  /** Family-owned fields only. After the family submits, the carer cannot change them. */
  async saveIntake(actor: Actor, id: string, patch: { birthYear?: number; hometown?: string; favouriteTexts?: string[]; consent?: boolean }): Promise<Resident> {
    const r = await this.getResident(actor, id);
    if (actor.role === "family" && patch.consent !== true) throw new HttpError(400, "Please tick the consent box. Nothing is saved without it.");
    if (actor.role === "carer" && r.familySubmittedAt) throw new HttpError(403, "The family filled this intake. Ask them to change it.");
    this.validIntake({ birthYear: patch.birthYear ?? r.birthYear, favouriteTexts: patch.favouriteTexts });
    if (patch.birthYear !== undefined) r.birthYear = patch.birthYear;
    if (patch.hometown !== undefined) {
      this.checkText(patch.hometown, "hometown");
      r.hometown = patch.hometown.trim();
    }
    if (patch.favouriteTexts) {
      const keep = new Map(r.favourites.map((f) => [f.text.toLowerCase(), f]));
      r.favourites = patch.favouriteTexts.slice(0, 5).map((t) => keep.get(t.trim().toLowerCase()) ?? { text: t.trim(), kind: "unresolved" as const, id: null, name: null, type: null, confirmed: false });
    }
    r.updatedAt = new Date().toISOString();
    if (actor.role === "family") {
      r.familySubmittedAt = r.updatedAt;
      r.consentRecord = { givenBy: "family", recordedBy: "family", at: r.updatedAt, version: 1 };
    }
    bumpWindow(r.birthYear, r.offsets);
    await this.d.store.put("residents", r.id, r, { homeId: r.homeId, residentId: r.id });
    return r;
  }

  async resolveForCarer(actor: Actor, id: string): Promise<Array<{ text: string; confirmed: boolean; resolution: Resolution | null }>> {
    if (actor.role !== "carer") throw new HttpError(403, "Only the carer confirms matches.");
    const r = await this.getResident(actor, id);
    const out = [];
    for (const f of r.favourites) {
      if (f.confirmed) out.push({ text: f.text, confirmed: true, resolution: null });
      else out.push({ text: f.text, confirmed: false, resolution: await resolveFavourite(this.d.client, f.text) });
    }
    return out;
  }

  async confirm(actor: Actor, id: string, text: string, pick: { id: string; name: string; type: string | null; kind: "entity" | "tag" } | null): Promise<Resident> {
    if (actor.role !== "carer") throw new HttpError(403, "Only the carer confirms matches.");
    const r = await this.getResident(actor, id);
    const f = r.favourites.find((x) => x.text === text);
    if (!f) throw new HttpError(404, "No such favourite.");
    if (pick) Object.assign(f, { kind: pick.kind, id: pick.id, name: pick.name, type: pick.type, confirmed: true, reason: undefined });
    else Object.assign(f, { kind: "unresolved", id: null, name: null, type: null, confirmed: false, reason: "The carer found no correct match." });
    r.updatedAt = new Date().toISOString();
    await this.d.store.put("residents", r.id, r, { homeId: r.homeId, residentId: r.id });
    return r;
  }

  // ---------- cards ----------
  async buildCard(residentId: string, o: { actor: Actor | "sample" | "public"; widenBy?: number; onEvent?: (e: TrailEvent) => void; resident?: Resident; persist?: boolean }): Promise<{ card: SessionCard; usage: UsageRecord; modelNote: string | null }> {
    const resident = o.resident ?? (o.actor === "sample" || o.actor === "public" ? await this.d.store.get<Resident>("residents", residentId) : await this.getResident(o.actor, residentId));
    if (!resident) throw new HttpError(404, "Resident not found.");
    const observations = o.persist === false ? [] : await this.d.store.list<Observation>("observations", { residentId });
    const cardId = `card-${randomUUID().slice(0, 8)}`;
    const t0 = Date.now();
    const result: AgentResult = await runCardAgent({ client: this.d.client, model: this.d.model, sabotage: this.d.sabotage }, { resident, observations, widenBy: o.widenBy ?? 0, onEvent: o.onEvent, cardId });
    const ms = Date.now() - t0;
    const usage: UsageRecord = {
      id: `use-${cardId}`, kind: "card", cardId, residentId: resident.id,
      liveQlooCalls: result.card.calls.filter((c) => !c.cached).length, cachedCalls: result.card.calls.filter((c) => c.cached).length,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, ms, at: new Date().toISOString(), sample: resident.isSample,
    };
    if (o.persist !== false) {
      const meta = { homeId: resident.homeId, residentId: resident.id };
      await this.d.store.put("cards", cardId, result.card, meta);
      const ev: Evidence = { ...result.evidence, birthYear: resident.birthYear, offsets: resident.offsets, currentYear: new Date().getUTCFullYear(), allowedNames: [resident.hometown, resident.careCity, ...resident.hometown.split(",").map((s) => s.trim())] };
      await this.d.store.put("evidence", cardId, ev, meta);
      await this.d.store.put("usage", usage.id, usage, meta);
    }
    return { card: result.card, usage, modelNote: result.modelNote };
  }

  async getCard(actor: Actor | "sample", cardId: string): Promise<SessionCard> {
    const c = await this.d.store.get<SessionCard>("cards", cardId);
    if (!c) throw new HttpError(404, "Card not found.");
    const r = await this.d.store.get<Resident>("residents", c.residentId);
    if (!r) throw new HttpError(404, "Card not found.");
    if (actor === "sample") {
      if (!r.isSample) throw new HttpError(404, "Card not found.");
    } else if (actor.role === "carer" ? r.homeId !== actor.homeId : r.id !== actor.residentId) throw new HttpError(404, "Card not found.");
    return c;
  }

  async exportCard(actor: Actor | "sample", cardId: string) {
    const card = await this.getCard(actor, cardId);
    const evidence = await this.d.store.get<Evidence>("evidence", cardId);
    return { card, evidence, note: "Run: node scripts/verify-card.mjs <this file>. The verifier calls neither Qloo nor a model." };
  }

  async listCards(actor: Actor, residentId: string): Promise<SessionCard[]> {
    await this.getResident(actor, residentId);
    return (await this.d.store.list<SessionCard>("cards", { residentId })).reverse();
  }

  // ---------- reactions ----------
  async logObservation(actor: Actor, cardId: string, entityId: string, value: string, note: string | null): Promise<Observation> {
    if (actor.role !== "carer") throw new HttpError(403, "Only the carer logs what she saw.");
    if (!(OBSERVATION_VALUES as string[]).includes(value)) throw new HttpError(400, "Unknown reaction.");
    const card = await this.getCard(actor, cardId);
    const item = card.items.find((i) => i.entityId === entityId);
    if (!item) throw new HttpError(400, "That item is not on this card.");
    if (note && (note.length > 280 || /[@<>]/.test(note))) throw new HttpError(400, "Notes are short plain text.");
    const o: Observation = { id: `obs-${randomUUID().slice(0, 8)}`, residentId: card.residentId, cardId, entityId, entityName: item.name, domain: item.domain, tags: item.tags, value: value as ObservationValue, note: note?.trim() || null, by: actor.userId, at: new Date().toISOString() };
    const r = await this.getResident(actor, card.residentId);
    await this.d.store.put("observations", o.id, o, { homeId: r.homeId, residentId: r.id });
    return o;
  }

  async timeline(actor: Actor, residentId: string) {
    const r = await this.getResident(actor, residentId);
    const [cards, observations] = await Promise.all([this.d.store.list<SessionCard>("cards", { residentId }), this.d.store.list<Observation>("observations", { residentId })]);
    const mem = memorySignals(observations);
    return { resident: r, cards: cards.reverse(), observations: observations.reverse(), works: mem.positive, avoid: mem.upset, expired: mem.expired };
  }

  async deleteObservation(actor: Actor, residentId: string, obsId: string) {
    const r = await this.getResident(actor, residentId);
    const o = await this.d.store.get<Observation>("observations", obsId);
    if (!o || o.residentId !== r.id) throw new HttpError(404, "Not found.");
    await this.d.store.delete("observations", obsId);
  }

  async saveSession(actor: Actor, cardId: string, p: { currentIndex: number; finished?: boolean }): Promise<Session> {
    if (actor.role !== "carer") throw new HttpError(403, "Only the carer runs a session.");
    const card = await this.getCard(actor, cardId);
    const now = new Date().toISOString();
    const prev = await this.d.store.get<Session>("sessions", cardId);
    const s: Session = { id: cardId, cardId, residentId: card.residentId, status: p.finished ? "finished" : "in_progress", currentIndex: Math.max(0, Math.min(card.items.length, p.currentIndex)), startedAt: prev?.startedAt ?? now, updatedAt: now };
    const r = await this.getResident(actor, card.residentId);
    await this.d.store.put("sessions", cardId, s, { homeId: r.homeId, residentId: r.id });
    return s;
  }

  async getSession(actor: Actor, cardId: string): Promise<Session | null> {
    await this.getCard(actor, cardId);
    return this.d.store.get<Session>("sessions", cardId);
  }

  // ---------- family ----------
  async createFamilyLink(actor: Actor, residentId: string): Promise<string> {
    if (actor.role !== "carer") throw new HttpError(403, "Only the carer creates a family link.");
    const r = await this.getResident(actor, residentId);
    const token = randomBytes(24).toString("base64url");
    await this.d.store.put("family_links", sha(token), { residentId: r.id, homeId: r.homeId, createdAt: new Date().toISOString(), revoked: false }, { residentId: r.id });
    return token;
  }

  async familyActor(token: string): Promise<Actor> {
    const link = await this.d.store.get<{ residentId: string; revoked: boolean }>("family_links", sha(token));
    if (!link || link.revoked) throw new HttpError(404, "This link is not valid.");
    return { role: "family", residentId: link.residentId };
  }

  async familyView(actor: Actor) {
    if (actor.role !== "family") throw new HttpError(403, "Family only.");
    const r = await this.getResident(actor, actor.residentId);
    const [obs, digests] = await Promise.all([this.d.store.list<Observation>("observations", { residentId: r.id }), this.d.store.list<Digest>("digests", { residentId: r.id })]);
    const mem = memorySignals(obs);
    return { resident: { id: r.id, firstName: r.firstName, birthYear: r.birthYear, hometown: r.hometown, favourites: r.favourites.map((f) => ({ text: f.text, confirmed: f.confirmed, name: f.name })), window: bumpWindow(r.birthYear, r.offsets) }, memory: obs.reverse().map((o) => ({ id: o.id, name: o.entityName, domain: o.domain, value: o.value, at: o.at, note: o.note })), works: mem.positive.map((o) => o.entityName), avoid: mem.upset.map((o) => o.entityName), digests: digests.reverse() };
  }

  // ---------- digest (runs without anyone asking) ----------
  async runDigests(by: "scheduler" | "manual", now = new Date()) {
    const startedAt = now.toISOString();
    const week = isoWeek(now);
    const residents = await this.d.store.list<Resident>("residents");
    let created = 0;
    let skipped = 0;
    for (const r of residents.filter((x) => !x.isSample)) {
      const obs = (await this.d.store.list<Observation>("observations", { residentId: r.id })).filter((o) => now.getTime() - Date.parse(o.at) <= 7 * 86400000);
      if (obs.length === 0) continue;
      const claimed = await this.d.store.putIfAbsent("digests", `${r.id}:${week}`, this.buildDigest(r, obs, week, by, startedAt), { homeId: r.homeId, residentId: r.id });
      if (claimed) created++;
      else skipped++;
    }
    const run = { id: `run-${week}-${by}-${randomUUID().slice(0, 6)}`, by, week, startedAt, finishedAt: new Date().toISOString(), created, skipped, residentsChecked: residents.length };
    await this.d.store.put("runs", run.id, run);
    return run;
  }

  buildDigest(r: Resident, obs: Observation[], week: string, by: "scheduler" | "manual", at: string): Digest {
    const counts: Record<string, number> = {};
    for (const o of obs) counts[o.value] = (counts[o.value] ?? 0) + 1;
    const worked = [...new Set(obs.filter((o) => o.value === "lit_up" || o.value === "sang_or_moved").map((o) => o.entityName))];
    const upset = new Set(obs.filter((o) => o.value === "upset").map((o) => o.entityName));
    const lines = [
      `${obs.length} reaction${obs.length === 1 ? "" : "s"} logged for ${r.firstName} this week.`,
      worked.length ? `What worked: ${worked.slice(0, 5).join(", ")}.` : "Nothing stood out this week.",
      upset.size ? `Stays off the cards: ${[...upset].slice(0, 8).join(", ")}.` : `Nothing upset ${r.firstName} this week.`,
    ];
    for (const l of lines) {
      const bad = [...houseStyleViolations(l), ...claimViolations(l)];
      if (bad.length) throw new Error(`digest text breaks house style: ${bad.join(",")}`);
    }
    return { id: `${r.id}:${week}`, residentId: r.id, week, createdAt: at, by, lines, counts };
  }

  // ---------- life story ----------
  async lifeStory(actor: Actor, residentId: string): Promise<Buffer> {
    const r = await this.getResident(actor, residentId);
    const obs = await this.d.store.list<Observation>("observations", { residentId });
    const mem = memorySignals(obs);
    const story: LifeStory = {
      firstName: r.firstName,
      birthYear: r.birthYear,
      hometown: r.hometown,
      window: bumpWindow(r.birthYear, r.offsets),
      favourites: r.favourites.filter((f) => f.confirmed).map((f) => f.name ?? f.text),
      works: mem.positive.map((o) => ({ name: o.entityName, domain: o.domain, value: o.value })),
      avoid: mem.upset.map((o) => o.entityName),
      updated: new Date().toISOString().slice(0, 10),
    };
    return lifeStoryPdf(story);
  }

  // ---------- compare and group ----------
  async compare(residentId: string, actor: Actor | "sample"): Promise<{ plain: PlainResult; card: SessionCard | null }> {
    if (!this.d.model) throw new HttpError(503, "No model is configured, so the plain AI list cannot be produced.");
    const r = actor === "sample" ? await this.d.store.get<Resident>("residents", residentId) : await this.getResident(actor, residentId);
    if (!r) throw new HttpError(404, "Resident not found.");
    const window = bumpWindow(r.birthYear, r.offsets);
    const t0 = Date.now();
    const { value, calls } = await this.d.client.trace(() => runPlainAi({ client: this.d.client, model: this.d.model as Model }, r, window));
    const useId = `use-plain-${randomUUID().slice(0, 6)}`;
    const rec: UsageRecord = { id: useId, kind: "plain", cardId: null, residentId: r.id, liveQlooCalls: calls.filter((c) => !c.cached).length, cachedCalls: calls.filter((c) => c.cached).length, inputTokens: value.usage.inputTokens, outputTokens: value.usage.outputTokens, ms: Date.now() - t0, at: new Date().toISOString(), sample: r.isSample };
    await this.d.store.put("usage", useId, rec, { homeId: r.homeId, residentId: r.id });
    const cards = await this.d.store.list<SessionCard>("cards", { residentId: r.id });
    return { plain: value, card: cards[cards.length - 1] ?? null };
  }

  /** The agent decides when to call plan_group_session. The server computes the plan. */
  async groupWithAgent(actor: Actor | "sample", residentIds: string[]): Promise<GroupAgentResult> {
    if (residentIds.length < 2 || residentIds.length > 8) throw new HttpError(400, "Pick 2 to 8 residents.");
    const list: Array<{ id: string; firstName: string; birthYear: number }> = [];
    for (const id of residentIds) {
      const r = actor === "sample" ? await this.d.store.get<Resident>("residents", id) : await this.getResident(actor, id);
      if (!r || (actor === "sample" && !r.isSample)) throw new HttpError(404, "Resident not found.");
      list.push({ id: r.id, firstName: r.firstName, birthYear: r.birthYear });
    }
    return runGroupAgent({ model: this.d.model }, list, (ids) => this.group(actor, ids));
  }

  async group(actor: Actor | "sample", residentIds: string[]): Promise<GroupResult> {
    if (residentIds.length < 2 || residentIds.length > 8) throw new HttpError(400, "Pick 2 to 8 residents.");
    const list = [];
    for (const id of residentIds) {
      const r = actor === "sample" ? await this.d.store.get<Resident>("residents", id) : await this.getResident(actor, id);
      if (!r || (actor === "sample" && !r.isSample)) throw new HttpError(404, "Resident not found.");
      list.push({ resident: r, observations: await this.d.store.list<Observation>("observations", { residentId: id }) });
    }
    try {
      return await planGroupSession(this.d.client, { residents: list });
    } catch (e) {
      if (e instanceof RangeError) throw new HttpError(409, e.message);
      throw e;
    }
  }

  // ---------- samples ----------
  loadSampleSeeds(): Array<{ id: string; firstName: string; birthYear: number; careCity: string; hometown: string; favourites: string[] }> {
    return existsSync(this.d.samplesPath) ? JSON.parse(readFileSync(this.d.samplesPath, "utf8")) : [];
  }

  /** Sample residents are confirmed by exact name match at seeding and labelled Sample everywhere. */
  async ensureSamples(): Promise<Resident[]> {
    const out: Resident[] = [];
    for (const s of this.loadSampleSeeds()) {
      let r = await this.d.store.get<Resident>("residents", s.id);
      if (!r) {
        const favourites: Favourite[] = [];
        for (const t of s.favourites) {
          const pick = await autoConfirm(this.d.client, t);
          favourites.push(pick ? { text: t, kind: pick.kind, id: pick.id, name: pick.name, type: pick.type, confirmed: true } : { text: t, kind: "unresolved", id: null, name: null, type: null, confirmed: false, reason: "Qloo has no exact match for it" });
        }
        const now = new Date().toISOString();
        r = { id: s.id, homeId: "sample", firstName: s.firstName, birthYear: s.birthYear, careCity: s.careCity, hometown: s.hometown, favourites, offsets: DEFAULT_OFFSETS, consent: true, consentRecord: null, intakeBy: "carer", familySubmittedAt: null, isSample: true, createdAt: now, updatedAt: now };
        await this.d.store.put("residents", r.id, r, { homeId: "sample", residentId: r.id });
      }
      out.push(r);
    }
    return out;
  }
}
