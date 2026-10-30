// Pure computations for the pre-registered findings F1 to F5 (docs/PREREG.md). The script
// scripts/probe-matrix.mjs makes the Qloo calls and hands the results here. No number in FINDINGS.md
// is typed by hand: each comes from one of these functions.
import { kendallTau, mean, round, signTest, type SignTest } from "./stats.ts";

export const POPULARITY_CEILING = 0.85;

export interface F1Row {
  form: string;
  domain: string;
  /** popularity of the top eight under the cohort signal only, then under his own signals, same window */
  cohortTop8: Array<{ id: string; popularity: number | null }>;
  ownTop8: Array<{ id: string; popularity: number | null }>;
}

export interface F1Result {
  forms: number;
  meanPopularityCohortOnly: number | null;
  meanPopularityOwn: number | null;
  /** mean number of the top eight that are widely known (popularity above the ceiling) */
  meanWidelyKnownCohortOnly: number | null;
  meanWidelyKnownOwn: number | null;
  /** sign test on (cohort minus own) mean popularity, per form; positive means cohort-only is more popular */
  sign: SignTest;
  supports: boolean;
  skipped: number;
}

const popOf = (xs: Array<{ popularity: number | null }>) => {
  const v = xs.map((x) => x.popularity).filter((x): x is number => x !== null);
  return v.length ? (mean(v) as number) : null;
};
const known = (xs: Array<{ popularity: number | null }>) => xs.filter((x) => x.popularity !== null && x.popularity >= POPULARITY_CEILING).length;

export function computeF1(rows: F1Row[]): F1Result {
  const usable = rows.filter((r) => r.cohortTop8.length >= 4 && r.ownTop8.length >= 4 && popOf(r.cohortTop8) !== null && popOf(r.ownTop8) !== null);
  const diffs = usable.map((r) => (popOf(r.cohortTop8) as number) - (popOf(r.ownTop8) as number));
  const sign = signTest(diffs);
  return {
    forms: usable.length,
    meanPopularityCohortOnly: round(mean(usable.map((r) => popOf(r.cohortTop8) as number))),
    meanPopularityOwn: round(mean(usable.map((r) => popOf(r.ownTop8) as number))),
    meanWidelyKnownCohortOnly: round(mean(usable.map((r) => known(r.cohortTop8))), 2),
    meanWidelyKnownOwn: round(mean(usable.map((r) => known(r.ownTop8))), 2),
    sign,
    supports: sign.p !== null && sign.p < 0.05 && sign.positive > sign.negative,
    skipped: rows.length - usable.length,
  };
}

export interface F2Row {
  form: string;
  /** dated card items, by entity id */
  cardItems: string[];
}

/** Overlap of each card with the union of all cohort-only results. Lower is more personal. */
export function computeF2(rows: F2Row[], cohortUnion: Set<string>) {
  const per = rows.filter((r) => r.cardItems.length > 0).map((r) => ({ form: r.form, items: r.cardItems.length, inUnion: r.cardItems.filter((id) => cohortUnion.has(id)).length }));
  const share = per.map((p) => p.inUnion / p.items);
  return {
    forms: per.length,
    unionSize: cohortUnion.size,
    meanOverlapPct: round((mean(share) ?? 0) * 100, 1),
    totalItems: per.reduce((a, p) => a + p.items, 0),
    totalInUnion: per.reduce((a, p) => a + p.inUnion, 0),
    perForm: per,
  };
}

export interface F3Row {
  form: string;
  /** film pool ranked with film anchors only, then with the music anchor added (best first) */
  withoutMusic: string[];
  withMusic: string[];
}

export function computeF3(rows: F3Row[]) {
  const taus = rows.map((r) => ({ form: r.form, tau: kendallTau(r.withoutMusic, r.withMusic) })).filter((x): x is { form: string; tau: number } => x.tau !== null);
  return {
    forms: taus.length,
    meanTau: round(mean(taus.map((t) => t.tau))),
    /** forms where the music anchor changed the order at all */
    formsChanged: taus.filter((t) => t.tau < 1).length,
    perForm: taus,
    skipped: rows.length - taus.length,
  };
}

export interface F4Row {
  form: string;
  type: string;
  window: { start: number; end: number };
  years: Array<number | null>;
}

export function computeF4(rows: F4Row[]) {
  const by = new Map<string, { returned: number; dated: number; outside: number }>();
  for (const r of rows) {
    const b = by.get(r.type) ?? { returned: 0, dated: 0, outside: 0 };
    for (const y of r.years) {
      b.returned++;
      if (y === null) continue;
      b.dated++;
      if (y < r.window.start || y > r.window.end) b.outside++;
    }
    by.set(r.type, b);
  }
  return Object.fromEntries([...by].map(([k, v]) => [k, { ...v, violationPct: v.dated ? round((v.outside / v.dated) * 100, 1) : null }]));
}

export interface F5Row {
  form: string;
  hometownTokens: string[];
  careTokens: string[];
  addresses: Array<string | null>;
}

export function computeF5(rows: F5Row[]) {
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ");
  let total = 0;
  let inHome = 0;
  let inCare = 0;
  let noAddress = 0;
  const per = rows.map((r) => {
    let h = 0;
    let c = 0;
    let n = 0;
    for (const a of r.addresses) {
      if (!a) {
        noAddress++;
        continue;
      }
      n++;
      const t = norm(a);
      if (r.hometownTokens.some((x) => x && t.includes(norm(x).trim()))) h++;
      if (r.careTokens.some((x) => x && t.includes(norm(x).trim()))) c++;
    }
    total += n;
    inHome += h;
    inCare += c;
    return { form: r.form, withAddress: n, inHometown: h, inCareCity: c };
  });
  return { forms: rows.length, placesWithAddress: total, noAddress, inHometownPct: total ? round((inHome / total) * 100, 1) : null, inCareCityPct: total ? round((inCare / total) * 100, 1) : null, perForm: per };
}

/**
 * The headline sentence. Written only when F1 supports it (the pre-registered rule). It quotes F2, the
 * clearer number: the share of a card's items that a list built from the age cohort alone would also
 * contain. (F1's "widely known in the top eight" counts are shown in FINDINGS.md but are a weak
 * headline, because Qloo's popularity is a percentile and almost everything older scores high.)
 */
export function discoverySentence(f1: F1Result | null, f2: { meanOverlapPct: number | null; forms: number } | null = null): { sentence: string | null; strongest: string | null } {
  if (!f1 || !f1.supports || !f2 || f2.meanOverlapPct === null || f2.forms === 0) return { sentence: null, strongest: null };
  return {
    sentence: `Built from the 55 and older audience alone, a list leans on the same famous names for everyone. Only ${f2.meanOverlapPct} percent of what Aftersong puts on a card would be on such a list, built from Qloo results for the same ${f2.forms} forms with no favourites, because it starts from what his family remembered.`,
    strongest: "F1 and F2",
  };
}
