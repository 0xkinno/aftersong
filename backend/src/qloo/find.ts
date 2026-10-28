// Finds candidates for one domain. Dated domains (music, film, TV) are scored twice over the SAME
// pinned pool: once with the person's own signals and once with the age cohort. Affinity is only
// comparable between calls that share a signal, so the two scores are compared as RANKS inside each
// pinned call, never as raw numbers. Food and places are open queries tied to a place and are never
// pinned: location acts as a hard filter on a pinned pool.
import type { QlooClient } from "./client.ts";
import type { QlooEntity } from "./entity.ts";
import type { Params } from "./guard.ts";
import { DATED, type Candidate, type Domain, type Window } from "../core/types.ts";

export const DOMAIN_TYPE: Record<Domain, string> = {
  music: "urn:entity:artist",
  film: "urn:entity:movie",
  tv: "urn:entity:tv_show",
  food: "urn:entity:place",
  place: "urn:entity:destination",
};
const YEAR_FILTER: Record<Domain, boolean> = { music: false, film: true, tv: true, food: false, place: false };
export const COHORT_BRACKET = "55_and_older";
export type MusicStrategy = "artist" | "person";

export interface FindArgs {
  client: QlooClient;
  domain: Domain;
  signalEntityIds: string[];
  signalTagIds?: string[];
  filterTagIds?: string[];
  window: Window;
  excludeIds: string[];
  /** Locality id. Only used for food and places, as an open query. */
  location?: string;
  take?: number;
  /** "person" asks for people born so they were adults in the window, when artists carry no years. */
  musicStrategy?: MusicStrategy;
}

export interface FindResult {
  candidates: Candidate[];
  callIds: string[];
  /** Plain-language notes for the trail. */
  notes: string[];
  returned: QlooEntity[];
  /** Share of returned candidates that carry a year. The agent uses it to switch music strategy. */
  datedShare: number;
  strategy: MusicStrategy | null;
}

const join = (a: string[]) => a.join(",");

/** Ranks by query.affinity, high first. Items without affinity get no rank. */
function rankByAffinity(entities: QlooEntity[]): { ranks: Map<string, number>; n: number; aff: Map<string, number> } {
  const scored = entities.filter((e) => e.affinity !== null).sort((a, b) => (b.affinity as number) - (a.affinity as number));
  return { ranks: new Map(scored.map((e, i) => [e.id, i + 1])), n: scored.length, aff: new Map(scored.map((e) => [e.id, e.affinity as number])) };
}

export async function findDomain(a: FindArgs): Promise<FindResult> {
  const dated = DATED[a.domain];
  const strategy: MusicStrategy | null = a.domain === "music" ? (a.musicStrategy ?? "artist") : null;
  const type = strategy === "person" ? "urn:entity:person" : DOMAIN_TYPE[a.domain];
  const base: Params = { "filter.type": type, take: a.take ?? 30 };
  if (YEAR_FILTER[a.domain]) {
    base["filter.release_year.min"] = a.window.start;
    base["filter.release_year.max"] = a.window.end;
  }
  if (strategy === "person") {
    base["filter.date_of_birth.min"] = a.window.start - 45;
    base["filter.date_of_birth.max"] = a.window.end - 15;
  }
  if (a.excludeIds.length) base["filter.exclude.entities"] = join(a.excludeIds.slice(0, 60));
  if (!dated) {
    if (a.location) base["signal.location"] = a.location;
    if (a.filterTagIds?.length) base["filter.tags"] = join(a.filterTagIds);
  }

  const personalSignals: Params = { "feature.explainability": true };
  if (a.signalEntityIds.length) personalSignals["signal.interests.entities"] = join(a.signalEntityIds);
  if (a.signalTagIds?.length) personalSignals["signal.interests.tags"] = join(a.signalTagIds);
  const cohortSignals: Params = { "signal.demographics.age": COHORT_BRACKET };

  const callIds: string[] = [];
  const notes: string[] = [];
  const personal = await a.client.insights({ ...base, ...personalSignals });
  callIds.push(personal.callId);

  const eraFix = (e: QlooEntity): QlooEntity =>
    strategy === "person" && e.birthYear !== null ? { ...e, year: e.birthYear + 25, yearEnd: e.birthYear + 45, yearSource: "person:dob+25..45" } : e;

  let pinnedP: QlooEntity[] = [];
  let pinnedC: QlooEntity[] = [];
  let open: QlooEntity[] = personal.entities;
  if (dated) {
    const cohort = await a.client.insights({ ...base, ...cohortSignals });
    callIds.push(cohort.callId);
    const pool: string[] = [];
    for (const e of [...personal.entities, ...cohort.entities]) if (!pool.includes(e.id)) pool.push(e.id);
    const pin: Params = { "filter.results.entities": join(pool.slice(0, 60)) };
    const p = await a.client.insights({ ...base, ...personalSignals, ...pin });
    const c = await a.client.insights({ ...base, ...cohortSignals, ...pin });
    callIds.push(p.callId, c.callId);
    pinnedP = p.entities;
    pinnedC = c.entities;
    notes.push(`Ranked ${Math.min(pool.length, 60)} items twice over the same pool, once for him and once for his generation`);
    open = [...personal.entities, ...cohort.entities];
  }

  const byId = new Map<string, QlooEntity>();
  for (const e of [...open, ...pinnedP, ...pinnedC]) if (!byId.has(e.id)) byId.set(e.id, eraFix(e));
  const explainOf = new Map<string, unknown>();
  for (const e of [...personal.entities, ...pinnedP]) if (e.explainability) explainOf.set(e.id, e.explainability);

  const P = rankByAffinity(dated ? pinnedP : personal.entities);
  const C = dated ? rankByAffinity(pinnedC) : { ranks: new Map<string, number>(), n: 0, aff: new Map<string, number>() };

  const candidates: Candidate[] = [...byId.values()].map((e) => ({
    ...e,
    domain: a.domain,
    personalAffinity: P.aff.get(e.id) ?? null,
    cohortAffinity: C.aff.get(e.id) ?? null,
    personalRank: P.ranks.get(e.id) ?? null,
    cohortRank: C.ranks.get(e.id) ?? null,
    personalN: P.n,
    cohortN: C.n,
    signalIds: P.ranks.has(e.id) ? [...a.signalEntityIds] : [],
    driverId: topDriver(explainOf.get(e.id), a.signalEntityIds),
    callIds: [...callIds],
  }));
  const withYear = candidates.filter((c) => c.year !== null).length;
  return { candidates, callIds, notes, returned: [...byId.values()], datedShare: candidates.length ? withYear / candidates.length : 0, strategy };
}

/** Best effort: finds the input entity whose score is highest inside Qloo's explainability block. */
export function topDriver(explain: unknown, signalIds: string[]): string | null {
  if (signalIds.length === 1) return signalIds[0] as string;
  if (!explain || signalIds.length < 2) return null;
  const SCORE = ["score", "weight", "affinity", "contribution", "influence", "value"];
  let best: { id: string; score: number } | null = null;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const id = Object.values(o).find((x): x is string => typeof x === "string" && signalIds.includes(x));
    const key = SCORE.find((k) => typeof o[k] === "number");
    if (id && key && (best === null || (o[key] as number) > best.score)) best = { id, score: o[key] as number };
    Object.values(o).forEach(walk);
  };
  walk(explain);
  return best ? (best as { id: string }).id : null;
}
