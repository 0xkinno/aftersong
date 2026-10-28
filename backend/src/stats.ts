// Standard-library statistics only. Exact binomial and sign tests are enough for these sample sizes.

/** log of n choose k, stable for the sizes used here. */
function logChoose(n: number, k: number): number {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
  return s;
}

/** P(X = k) for X ~ Binomial(n, p). */
export function binomialPmf(n: number, k: number, p = 0.5): number {
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Two-sided exact binomial test against p = 0.5: the sum of all outcomes no more likely than the observed one. */
export function binomialTwoSided(n: number, k: number, p = 0.5): number {
  if (n === 0) return 1;
  const observed = binomialPmf(n, k, p);
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const pi = binomialPmf(n, i, p);
    if (pi <= observed * (1 + 1e-9)) total += pi;
  }
  return Math.min(1, total);
}

export interface SignTest {
  n: number;
  positive: number;
  negative: number;
  ties: number;
  /** Two-sided exact p-value over the non-tied pairs. Null when every pair tied. */
  p: number | null;
  /** Plain words for the report. */
  verdict: "significant at 0.05" | "not significant at 0.05" | "no usable pairs";
}

/** Paired sign test on differences (a minus b). Ties are dropped, as is standard. */
export function signTest(differences: number[]): SignTest {
  const positive = differences.filter((d) => d > 0).length;
  const negative = differences.filter((d) => d < 0).length;
  const ties = differences.length - positive - negative;
  const n = positive + negative;
  if (n === 0) return { n: 0, positive, negative, ties, p: null, verdict: "no usable pairs" };
  const p = binomialTwoSided(n, positive);
  return { n, positive, negative, ties, p, verdict: p < 0.05 ? "significant at 0.05" : "not significant at 0.05" };
}

/** Kendall tau-b between two rankings of the same items (lists of ids, best first). Null when fewer than two shared items. */
export function kendallTau(a: string[], b: string[]): number | null {
  const common = a.filter((x) => b.includes(x));
  const n = common.length;
  if (n < 2) return null;
  const ra = new Map(a.map((x, i) => [x, i]));
  const rb = new Map(b.map((x, i) => [x, i]));
  let conc = 0;
  let disc = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const da = (ra.get(common[i] as string) as number) - (ra.get(common[j] as string) as number);
      const db = (rb.get(common[i] as string) as number) - (rb.get(common[j] as string) as number);
      if (da * db > 0) conc++;
      else if (da * db < 0) disc++;
    }
  }
  const pairs = (n * (n - 1)) / 2;
  return Math.round(((conc - disc) / pairs) * 1000) / 1000;
}

export const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
export const round = (x: number | null, d = 3): number | null => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);
