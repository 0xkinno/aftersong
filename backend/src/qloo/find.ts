// Finds candidates for one domain and scores them twice: against the person's own signals and against
// the oldest age cohort. Items missing from one list are re-scored with filter.results.entities so
// both scores come from the same pool. A score that never comes back stays null.
import type { QlooClient } from "./client.ts";
import type { QlooEntity } from "./entity.ts";
import type { Params } from "./guard.ts";
import type { Candidate, Domain, Window } from "../core/types.ts";

export const DOMAIN_TYPE: Record<Domain, string> = {
  music: "urn:entity:artist",
  film: "urn:entity:movie",
  tv: "urn:entity:tv_show",
  food: "urn:entity:place",
  place: "urn:entity:destination",
};
const YEAR_FILTER: Record<Domain, boolean> = { music: false, film: true, tv: true, food: false, place: false };
export const COHORT_BRACKET = "55_and_older";

export interface FindArgs {
  client: QlooClient;
  domain: Domain;
  signalEntityIds: string[];
  signalTagIds?: string[];
  filterTagIds?: string[];
  window: Window;
  excludeIds: string[];
  /** Locality id or "POINT(lon lat)". */
  location?: string;
  take?: number;
}

export interface FindResult {
  candidates: Candidate[];
  callIds: string[];
  /** Plain-language notes for the trail, for example which score was re-checked. */
  notes: string[];
  returned: QlooEntity[];
}

const join = (a: string[]) => a.join(",");

export async function findDomain(a: FindArgs): Promise<FindResult> {
  const type = DOMAIN_TYPE[a.domain];
  const base: Params = { "filter.type": type, take: a.take ?? 30 };
  if (YEAR_FILTER[a.domain]) {
    base["filter.release_year.min"] = a.window.start;
    base["filter.release_year.max"] = a.window.end;
  }
  if (a.excludeIds.length) base["filter.exclude.entities"] = join(a.excludeIds.slice(0, 60));
  if (a.location) base["signal.location"] = a.location;
  if (a.filterTagIds?.length) base["filter.tags"] = join(a.filterTagIds);

  const personalSignals: Params = { "signal.interests.entities": join(a.signalEntityIds), "feature.explainability": true };
  if (a.signalTagIds?.length) personalSignals["signal.interests.tags"] = join(a.signalTagIds);
  const cohortSignals: Params = { "signal.demographics.age": COHORT_BRACKET };

  const callIds: string[] = [];
  const notes: string[] = [];
  const personal = await a.client.insights({ ...base, ...personalSignals });
  callIds.push(personal.callId);
  const cohort = await a.client.insights({ ...base, ...cohortSignals });
  callIds.push(cohort.callId);

  const byId = new Map<string, QlooEntity>();
  const pAff = new Map<string, number | null>();
  const cAff = new Map<string, number | null>();
  const pRankOrder: string[] = [];
  const cRankOrder: string[] = [];
  const callsFor = new Map<string, string[]>();
  const note = (id: string, call: string) => callsFor.set(id, [...(callsFor.get(id) ?? []), call]);

  personal.entities.forEach((e) => {
    byId.set(e.id, e);
    pAff.set(e.id, e.affinity);
    pRankOrder.push(e.id);
    note(e.id, personal.callId);
  });
  cohort.entities.forEach((e) => {
    if (!byId.has(e.id)) byId.set(e.id, e);
    cAff.set(e.id, e.affinity);
    cRankOrder.push(e.id);
    note(e.id, cohort.callId);
  });

  const missingPersonal = [...cAff.keys()].filter((id) => !pAff.has(id) && !pRankOrder.includes(id));
  const missingCohort = [...pAff.keys()].filter((id) => !cAff.has(id) && !cRankOrder.includes(id));

  if (missingPersonal.length) {
    const r = await a.client.insights({ ...base, ...personalSignals, "filter.results.entities": join(missingPersonal.slice(0, 60)) });
    callIds.push(r.callId);
    notes.push(`Scored ${missingPersonal.length} cohort items against the favourites`);
    r.entities.forEach((e) => {
      pAff.set(e.id, e.affinity);
      pRankOrder.push(e.id);
      note(e.id, r.callId);
      if (!byId.has(e.id)) byId.set(e.id, e);
    });
  }
  if (missingCohort.length) {
    const r = await a.client.insights({ ...base, ...cohortSignals, "filter.results.entities": join(missingCohort.slice(0, 60)) });
    callIds.push(r.callId);
    notes.push(`Scored ${missingCohort.length} personal items against the age cohort`);
    r.entities.forEach((e) => {
      cAff.set(e.id, e.affinity);
      cRankOrder.push(e.id);
      note(e.id, r.callId);
    });
  }

  const rankBy = (order: string[], aff: Map<string, number | null>): Map<string, number> => {
    const ids = [...new Set(order)];
    const sorted = ids.sort((x, y) => (aff.get(y) ?? -1) - (aff.get(x) ?? -1) || order.indexOf(x) - order.indexOf(y));
    return new Map(sorted.map((id, i) => [id, i + 1]));
  };
  const pRank = rankBy(pRankOrder, pAff);
  const cRank = rankBy(cRankOrder, cAff);

  const candidates: Candidate[] = [...byId.values()].map((e) => ({
    ...e,
    domain: a.domain,
    personalAffinity: pAff.get(e.id) ?? null,
    cohortAffinity: cAff.get(e.id) ?? null,
    personalRank: pRank.get(e.id) ?? null,
    cohortRank: cRank.get(e.id) ?? null,
    signalIds: pRank.has(e.id) ? [...a.signalEntityIds] : [],
    callIds: callsFor.get(e.id) ?? [],
  }));
  return { candidates, callIds, notes, returned: [...byId.values()] };
}
