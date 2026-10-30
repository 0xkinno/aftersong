// The agent. The model chooses which tools to call and in what order, and writes one opener per
// item. It never chooses what goes on the card: tools run rules in code (core/), and write_openers
// accepts only text that passes the opener filters. If the model is unavailable the same steps run
// in fixed order and the card is labelled as built without a model.
import { buildCard } from "../core/card.ts";
import { memorySignals, type Observation } from "../core/memory.ts";
import { settleOpener, type OpenerContext } from "../core/openers.ts";
import { routeSignals } from "../core/route.ts";
import { DATED, DOMAINS, type Candidate, type Decision, type Domain, type SessionCard } from "../core/types.ts";
import { spanInWindow } from "../core/window.ts";
import { bumpWindow } from "../core/window.ts";
import type { QlooClient } from "../qloo/client.ts";
import { findDomain } from "../qloo/find.ts";
import { resolveCuisineTags, resolveLocality } from "../qloo/resolve.ts";
import type { Resident } from "../store/types.ts";
import type { Model, Msg, ToolDef } from "./model.ts";

export class NeedsConfirmation extends Error {
  constructor() {
    super("The carer must confirm at least one favourite match before a card can be built.");
    this.name = "NeedsConfirmation";
  }
}

export type Sabotage = "none" | "model_injects";

export interface AgentDeps {
  client: QlooClient;
  model: Model | null;
  sabotage?: Sabotage;
  currentYear?: number;
}

export interface TrailEvent {
  at: string;
  tool: string;
  summary: string;
}

export interface AgentResult {
  card: SessionCard;
  evidence: CardEvidence;
  usage: { inputTokens: number; outputTokens: number; modelCalls: number };
  modelNote: string | null;
}

export interface CardEvidence {
  entities: Record<string, { name: string; year: number | null; yearEnd: number | null }>;
  seenNames: string[];
  requests: Array<{ path: string; params: Record<string, string | number | boolean | undefined> }>;
  confirmedIds: string[];
  positiveIds: string[];
  hometownIds: string[];
  /** Widely known ceiling per domain, from the pools. The plain AI arm is judged against the same ceilings. */
  ceilings: Record<string, number>;
  upsetIds: string[];
}

export const TOOLS: ToolDef[] = [
  { name: "resolve_favourites", description: "Check the resident's confirmed favourites and resolve the care home city, the hometown and hometown cuisine tags in Qloo. Call first.", schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "find_era_items", description: "Find candidates for one domain from the resident's years. Call once for each of music, film, tv, food, place.", schema: { type: "object", properties: { domain: { type: "string", enum: DOMAINS } }, required: ["domain"], additionalProperties: false } },
  { name: "read_observations", description: "Read how many reactions the carer has logged, and which items worked. Optional, call before find_era_items when memory may matter.", schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "build_card", description: "Assemble the session card from the candidates under the rules. Needs all five domains searched. You do not choose the items.", schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "write_openers", description: "Give one plain conversation opener per card item. Use only the item's own name and year. One short question, no other names, no medical claims, no dashes, no emoji.", schema: { type: "object", properties: { openers: { type: "array", items: { type: "object", properties: { entityId: { type: "string" }, text: { type: "string" } }, required: ["entityId", "text"] } } }, required: ["openers"], additionalProperties: false } },
];

const SYSTEM = `You prepare a reminiscence session card for a carer in a memory care home.
Call the tools in this order: resolve_favourites, find_era_items for each of music, film, tv, food and place, build_card, then write_openers with one line per item on the card.
You never choose which items are on the card; the tools do, under rules. You only decide the order of calls and write openers.
An opener is one warm question of 7 to 16 words that the carer can say aloud. It names the item exactly once, for example: Did you ever hear Sam Cooke on the radio? Use only the item's own name. For music never give a year, because the years shown are an artist's active years. For film and television you may give the year. Do not name anything else. Do not claim any health effect. Do not use dashes or emoji. Stop after write_openers.`;

const asText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runCardAgent(deps: AgentDeps, input: { resident: Resident; observations: Observation[]; widenBy?: number; onEvent?: (e: TrailEvent) => void; cardId: string; now?: number }): Promise<AgentResult> {
  const { resident } = input;
  const now = input.now ?? Date.now();
  const currentYear = deps.currentYear ?? new Date(now).getUTCFullYear();
  const widenBy = input.widenBy ?? 0;
  const window = bumpWindow(resident.birthYear, resident.offsets, widenBy, currentYear);
  const memory = memorySignals(input.observations, now);
  const trail: TrailEvent[] = [];
  const emit = (tool: string, summary: string) => {
    const e = { at: new Date().toISOString(), tool, summary };
    trail.push(e);
    input.onEvent?.(e);
  };

  const confirmed = resident.favourites.filter((f) => f.confirmed && f.id);
  const entityFavs = confirmed.filter((f) => f.kind === "entity");
  const tagFavs = confirmed.filter((f) => f.kind === "tag");
  const routes = routeSignals(confirmed, memory.positive);
  const decisions: Decision[] = [];
  const decide = (decision: Decision["decision"], why: string, call: string | null, count: number | null) => {
    decisions.push({ at: new Date().toISOString(), decision, why, call, count });
    emit("decision", why);
  };

  const state = {
    pools: {} as Partial<Record<Domain, Candidate[]>>,
    seenIds: new Set<string>(),
    seenNames: new Set<string>(),
    entities: {} as CardEvidence["entities"],
    careLocality: null as { id: string; name: string; point: string | null } | null,
    homeLocality: null as { id: string; name: string; point: string | null } | null,
    cuisineTagIds: [] as string[],
    cuisineNames: {} as Record<string, string>,
    resolved: false,
    card: null as SessionCard | null,
    openersDone: false,
  };

  if (entityFavs.length === 0 && memory.positive.length === 0) {
    emit("resolve_favourites", "No confirmed favourite yet. The carer must confirm a match first.");
    throw new NeedsConfirmation();
  }

  const traced = await deps.client.trace(async () => {
    const usage = { inputTokens: 0, outputTokens: 0, modelCalls: 0 };
    let modelNote: string | null = null;

    const openerCtx = (): OpenerContext => ({
      allowedNames: [...(state.card?.items.map((i) => i.name) ?? []), resident.hometown, resident.careCity, ...resident.hometown.split(",").map((s) => s.trim()), ...confirmed.map((f) => f.name ?? f.text)].filter(Boolean),
      knownNames: [...state.seenNames],
    });

    async function exec(name: string, args: Record<string, unknown>): Promise<string> {
      try {
        if (name === "resolve_favourites") {
          if (entityFavs.length === 0 && memory.positive.length === 0) {
            emit(name, "No confirmed favourite yet. The carer must confirm a match first.");
            return "ERROR: no confirmed favourite. Stop and report that the carer must confirm a match.";
          }
          const [care, home] = await Promise.all([resolveLocality(deps.client, resident.careCity).catch(() => null), resolveLocality(deps.client, resident.hometown).catch(() => null)]);
          state.careLocality = care;
          state.homeLocality = home;
          const region = resident.hometown.split(",").pop()?.trim() || resident.hometown;
          const cuisines = await resolveCuisineTags(deps.client, region).catch(() => []);
          state.cuisineTagIds = cuisines.map((t) => t.id);
          state.cuisineNames = Object.fromEntries(cuisines.map((t) => [t.id, `${t.name} cuisine, from the resident's hometown`]));
          state.resolved = true;
          for (const f of resident.favourites.filter((x) => !x.confirmed)) decide(f.reason ? "drop_favourite" : "ask_confirm", f.reason ? `Dropped "${f.text}": ${f.reason}. It is not used.` : `"${f.text}" is waiting for the carer to confirm a match, so this card is built without it.`, null, null);
          if (widenBy > 0) decide("widen_window", `The window was widened by ${widenBy} years after the carer agreed.`, null, null);
          if (routes.media.entityIds.length + routes.media.tagIds.length > 0 && routes.food.entityIds.length + routes.food.tagIds.length > 0) decide("route_signals", "Music and film favourites drive music, film and TV. Food favourites drive only food and places.", null, null);
          emit(name, `${entityFavs.length} confirmed favourite${entityFavs.length === 1 ? "" : "s"}. Home city ${care ? "found" : "not found"}, hometown ${home ? "found" : "not found"}, ${cuisines.length} cuisine tag${cuisines.length === 1 ? "" : "s"}.`);
          return `confirmed favourites: ${confirmed.map((f) => f.name).join(", ")}. window ${window.start} to ${window.end}. care city ${care ? "found" : "not found"}; hometown ${home ? "found" : "not found"}; cuisine tags ${cuisines.length}.`;
        }
        if (name === "read_observations") {
          emit(name, `${memory.positive.length} item${memory.positive.length === 1 ? "" : "s"} that worked, ${memory.upset.length} to avoid.`);
          return `worked: ${memory.positive.map((o) => o.entityName).join(", ") || "none"}; avoid count: ${memory.upset.length}`;
        }
        if (name === "find_era_items") {
          if (!state.resolved) return "ERROR: call resolve_favourites first.";
          const domain = args.domain as Domain;
          if (!DOMAINS.includes(domain)) return "ERROR: unknown domain.";
          const loc = domain === "food" ? state.careLocality : domain === "place" ? state.homeLocality : null;
          const location = loc ? (loc.point ?? loc.id) : undefined;
          if ((domain === "food" || domain === "place") && !location) {
            state.pools[domain] = [];
            emit(name, `${domain}: the ${domain === "food" ? "home city" : "hometown"} could not be found in Qloo, so nothing was searched.`);
            return `${domain}: no location, 0 candidates`;
          }
          const media = routes.media;
          const food = routes.food;
          const dated = DATED[domain];
          const sigE = dated ? media.entityIds : food.entityIds;
          // cuisine tags are a signal, not a hard filter: a hard filter plus a location can return nothing
          const cuisine = domain === "food" || domain === "place" ? state.cuisineTagIds : [];
          const cuisineHere = domain === "food" || domain === "place" ? state.cuisineTagIds : [];
          const sigT = dated ? media.tagIds : [...food.tagIds, ...cuisineHere];
          if (sigE.length + sigT.length + cuisine.length === 0) {
            state.pools[domain] = [];
            decide("abstain_domain", `${domain}: no favourite of the right kind to search from, so nothing was searched.`, null, 0);
            return `${domain}: no usable signal, 0 candidates`;
          }
          const args0 = { client: deps.client, domain, signalEntityIds: sigE, signalTagIds: sigT, window, excludeIds: memory.upset.map((o) => o.entityId), location, requireTagIds: domain === "food" ? [...food.tagIds, ...cuisine] : undefined, connectionIds: domain === "place" && state.homeLocality ? [state.homeLocality.id] : undefined };
          let r = await findDomain(args0);
          if (domain === "music" && r.candidates.length > 0 && r.datedShare < 0.3) {
            const alt = await findDomain({ ...args0, musicStrategy: "person" });
            const inWin = (x: typeof r) => x.candidates.filter((c) => c.year !== null && spanInWindow(window, c.year, c.yearEnd)).length;
            const better = inWin(alt) > inWin(r);
            decide("switch_music_strategy", `Artists came back with years for ${Math.round(r.datedShare * 100)} percent of items. Tried people born so they were adults in the window: ${inWin(alt)} fit against ${inWin(r)}. ${better ? "Using the people route, with years estimated from birth year." : "Keeping artists."}`, alt.callIds[0] ?? null, inWin(alt));
            if (better) r = alt;
          }
          state.pools[domain] = r.candidates;
          for (const e of r.returned) {
            state.seenIds.add(e.id);
            state.seenNames.add(e.name);
            state.entities[e.id] = { name: e.name, year: e.year, yearEnd: e.yearEnd };
          }
          const yearNote = domain === "music" ? " Qloo has no year filter for artists, so years are checked in code." : "";
          emit(name, `${domain}: ${r.candidates.length} candidates from ${r.callIds.length} Qloo calls.${yearNote}${r.notes.length ? " " + r.notes.join(". ") + "." : ""}`);
          return `${domain}: ${r.candidates.length} candidates`;
        }
        if (name === "build_card") {
          const missing = DOMAINS.filter((d) => !state.pools[d]);
          if (missing.length) return `ERROR: call find_era_items for: ${missing.join(", ")}`;
          state.card = buildCard({ cardId: input.cardId, residentId: resident.id, window, widenedBy: widenBy, favourites: resident.favourites, hometown: [...state.cuisineTagIds.map((id) => ({ id, name: state.cuisineNames[id] ?? "the resident's hometown cuisine" })), ...(state.homeLocality ? [{ id: state.homeLocality.id, name: `the resident's hometown, ${resident.hometown}` }] : [])], memory, pools: state.pools, seenIds: state.seenIds, model: deps.model ? { provider: deps.model.provider, id: deps.model.id } : null, trail: [], calls: [], now: new Date(now).toISOString() });
          const c = state.card;
          for (const ab of c.abstentions.filter((x) => x.domain !== "card")) decide("abstain_domain", `${ab.domain}: not enough from these years yet, so nothing was added from a guess.`, null, 0);
          const skipped = c.rejections.filter((x) => x.failures.some((f) => f.rule === "no_affinity")).length;
          if (skipped) decide("skip_item", `${skipped} items were skipped because Qloo returned no affinity for them.`, null, skipped);
          emit(name, `${c.items.length} items placed, ${c.rejections.length} candidates rejected under the rules${c.status === "thin" ? ". Not enough from these years yet." : "."}`);
          return `card items:\n${c.items.map((i) => `${i.entityId} | ${i.domain} | ${i.name} | ${i.domain === "music" ? "active " + i.year + " to " + (i.yearEnd ?? "now") : (i.year ?? "no year")}`).join("\n")}`;
        }
        if (name === "write_openers") {
          if (!state.card) return "ERROR: call build_card first.";
          const list = Array.isArray(args.openers) ? (args.openers as Array<{ entityId?: string; text?: string }>) : [];
          let accepted = 0;
          let blocked = 0;
          const ctx = openerCtx();
          for (const o of list) {
            const item = state.card.items.find((i) => i.entityId === o.entityId);
            if (!item || typeof o.text !== "string") {
              blocked++;
              continue;
            }
            const settled = settleOpener(item, o.text, ctx);
            item.opener = settled;
            if (settled.source === "model") accepted++;
            else blocked++;
          }
          state.openersDone = true;
          emit(name, `${accepted} model opener${accepted === 1 ? "" : "s"} accepted, ${blocked} blocked and replaced with a template line.`);
          return `accepted ${accepted}, blocked ${blocked}`;
        }
        return `ERROR: unknown tool ${name}`;
      } catch (e) {
        emit(name, `Failed: ${asText(e)}`);
        throw e;
      }
    }

    async function fixedOrder() {
      if (!state.resolved) await exec("resolve_favourites", {});
      for (const d of DOMAINS) if (!state.pools[d]) await exec("find_era_items", { domain: d });
      if (!state.card) await exec("build_card", {});
    }

    const model = deps.model;
    if (!model) {
      modelNote = "No model is configured. The card was built with template openers.";
      emit("agent", modelNote);
      await fixedOrder();
    } else {
      const messages: Msg[] = [{ role: "user", text: `Prepare the session card. The resident was born in ${resident.birthYear}; their window is ${window.start} to ${window.end}. Confirmed favourites: ${confirmed.length}.` }];
      try {
        for (let step = 0; step < 16; step++) {
          let reply = await model.complete(SYSTEM, messages, TOOLS);
          if (deps.sabotage === "model_injects") reply = sabotageReply(reply, state);
          usage.modelCalls++;
          usage.inputTokens += reply.usage.inputTokens;
          usage.outputTokens += reply.usage.outputTokens;
          messages.push({ role: "assistant", text: reply.text, toolCalls: reply.toolCalls });
          if (reply.toolCalls.length === 0) break;
          for (const call of reply.toolCalls) {
            let out: string;
            try {
              out = await exec(call.name, call.args);
            } catch (e) {
              out = `ERROR: ${asText(e)}`;
              if (e instanceof Error && /QLOO_/.test((e as { code?: string }).code ?? "")) throw e;
            }
            messages.push({ role: "tool", callId: call.id, name: call.name, text: out });
          }
          if (state.openersDone) break;
        }
      } catch (e) {
        if ((e as { name?: string }).name === "QlooError") throw e;
        console.error(`[model] unavailable: ${asText(e)}`);
        modelNote = "The model was unavailable, so openers are labelled template lines.";
        emit("agent", modelNote);
      }
      if (!state.card) {
        if (!modelNote) {
          modelNote = "The model stopped before building the card. Remaining steps ran in fixed order.";
          emit("agent", modelNote);
        }
        await fixedOrder();
      } else if (!state.openersDone && !modelNote) {
        modelNote = "The model did not write openers. Template lines are shown and labelled.";
        emit("agent", modelNote);
      }
    }
    return { usage, modelNote };
  });

  const card = state.card as SessionCard;
  card.trail = trail;
  card.decisions = decisions;
  card.calls = traced.calls.map((c) => ({ id: c.id, path: c.path, cached: c.cached, status: c.status, ms: c.ms, resultCount: c.resultCount }));
  if (traced.value.modelNote) card.model = null;
  return {
    card,
    evidence: {
      entities: state.entities,
      seenNames: [...state.seenNames],
      requests: traced.calls.map((c) => ({ path: c.path, params: c.params })),
      confirmedIds: confirmed.map((f) => f.id as string),
      positiveIds: memory.positive.map((o) => o.entityId),
      hometownIds: [...state.cuisineTagIds, ...(state.homeLocality ? [state.homeLocality.id] : [])],
      ceilings: Object.fromEntries(Object.entries(state.pools).map(([d, p]) => [d, (p as Candidate[])[0]?.popCeiling ?? 0.85])),
      upsetIds: memory.upset.map((o) => o.entityId),
    },
    usage: traced.value.usage,
    modelNote: traced.value.modelNote,
  };
}

/** Fault switch: the model tries to put an off-card line and an off-card entity into write_openers. */
function sabotageReply<T extends { toolCalls: Array<{ name: string; args: Record<string, unknown> }> }>(reply: T, state: { seenNames: Set<string>; card: SessionCard | null }): T {
  for (const c of reply.toolCalls) {
    if (c.name !== "write_openers") continue;
    const cardNames = new Set(state.card?.items.map((i) => i.name) ?? []);
    const intruder = [...state.seenNames].find((n) => !cardNames.has(n)) ?? "Frank Sinatra";
    const list = Array.isArray(c.args.openers) ? [...(c.args.openers as Array<{ entityId: string; text: string }>)] : [];
    if (list[0]) list[0] = { ...list[0], text: `Shall we play ${intruder} instead?` };
    list.push({ entityId: "off-card-entity", text: `Do you remember ${intruder}?` });
    c.args.openers = list;
  }
  return reply;
}
