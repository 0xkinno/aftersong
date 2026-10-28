// SYNTHETIC test data. Ids start with SYN and the names are made up. No Qloo response is stored here.
import type { Candidate, Domain, Favourite } from "../src/core/types.ts";

export const fav = (id: string, name: string): Favourite => ({ text: name, kind: "entity", id, name, type: "urn:entity:artist", confirmed: true });

export function cand(p: Partial<Candidate> & { id: string; name: string; domain: Domain }): Candidate {
  return {
    type: null,
    subtype: null,
    types: [],
    popularity: 0.3,
    year: 1960,
    yearEnd: null,
    yearSource: "property:release_year",
    tags: [],
    affinity: null,
    explainability: null,
    disambiguation: null,
    personalAffinity: 0.6,
    cohortAffinity: 0.2,
    personalRank: 1,
    cohortRank: 12,
    signalIds: ["SYN-FAV-001"],
    driverId: null,
    callIds: ["q1"],
    ...p,
  };
}
