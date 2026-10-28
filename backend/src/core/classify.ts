import type { Candidate, Label } from "./types.ts";

export const POPULARITY_CEILING = 0.85;
const AFFINITY_GAP = 0.1;
const RANK_GAP = 5;

/** Personal: ranks clearly higher for this person than for the cohort. Shared era: high for both.
 *  Widely known: Qloo reports high popularity. A missing cohort score is unknown, never zero. */
export function labelFor(c: Pick<Candidate, "popularity" | "personalAffinity" | "cohortAffinity" | "personalRank" | "cohortRank">, ceiling = POPULARITY_CEILING): { label: Label; cohortUnknown: boolean } {
  if (c.popularity !== null && c.popularity >= ceiling) return { label: "widely_known", cohortUnknown: c.cohortAffinity === null && c.cohortRank === null };
  const cohortUnknown = c.cohortAffinity === null && c.cohortRank === null;
  if (cohortUnknown) return { label: "personal", cohortUnknown: true };
  if (c.personalAffinity !== null && c.cohortAffinity !== null && c.personalAffinity - c.cohortAffinity >= AFFINITY_GAP) return { label: "personal", cohortUnknown: false };
  if (c.personalRank !== null && c.cohortRank !== null && c.cohortRank - c.personalRank >= RANK_GAP) return { label: "personal", cohortUnknown: false };
  return { label: "shared_era", cohortUnknown: false };
}
