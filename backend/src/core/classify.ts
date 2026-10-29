import { DATED, type Candidate, type Label } from "./types.ts";

export const POPULARITY_CEILING = 0.85;

type Rankable = Pick<Candidate, "domain" | "popularity" | "personalRank" | "cohortRank" | "personalN" | "cohortN"> & { popCeiling?: number };

/** Top quarter of the pool by popularity, never below the floor. Measured: nearly everything Qloo returns for older music and film is above 0.97. */
export function popularityCeiling(popularities: Array<number | null>, floor = POPULARITY_CEILING): number {
  const v = popularities.filter((x): x is number => x !== null).sort((a, b) => b - a);
  if (v.length < 8) return floor;
  return Math.max(floor, v[Math.ceil(v.length / 4) - 1] as number);
}

/**
 * Affinity is comparable only between calls that share a signal, so this compares RANKS inside two
 * calls over the same pinned pool, never raw affinities across the two calls.
 *   Personal: top third under his signals and bottom half under the cohort.
 *   Shared era: top third under both.
 *   Widely known: Qloo reports popularity above the ceiling, whatever the ranks.
 *   Some overlap: top third for him and in the middle band for the cohort, or not in his top third.
 *   Hometown: food and places, which are tied to a place and have no cohort comparison.
 * A missing cohort rank is unknown, never zero. Returns label null when his own rank is missing, so
 * the caller abstains on the item.
 */
export function labelFor(c: Rankable, ceiling = c.popCeiling ?? POPULARITY_CEILING): { label: Label | null; cohortUnknown: boolean } {
  if (c.popularity !== null && c.popularity >= ceiling) return { label: "widely_known", cohortUnknown: c.cohortRank === null };
  if (!DATED[c.domain]) return { label: "hometown", cohortUnknown: true };
  if (c.personalRank === null || !c.personalN) return { label: null, cohortUnknown: c.cohortRank === null };
  const topThirdHim = c.personalRank <= Math.ceil(c.personalN / 3);
  if (c.cohortRank === null || !c.cohortN) return { label: topThirdHim ? "personal" : "overlap", cohortUnknown: true };
  const topThirdCohort = c.cohortRank <= Math.ceil(c.cohortN / 3);
  const bottomHalfCohort = c.cohortRank > c.cohortN / 2;
  if (topThirdHim && bottomHalfCohort) return { label: "personal", cohortUnknown: false };
  if (topThirdHim && topThirdCohort) return { label: "shared_era", cohortUnknown: false };
  return { label: "overlap", cohortUnknown: false };
}
