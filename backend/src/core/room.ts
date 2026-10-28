// Room planner for 4 to 8 residents. One pool is re-scored for each resident (the caller does that
// with filter.results.entities). Items are chosen by maximin over the residents the item applies to.
// Unknown scores are unknown, never zero. Any resident's upset vetoes an item.
import { DATED, type Domain, type Window } from "./types.ts";
import { spanInWindow } from "./window.ts";

export interface RoomResident {
  id: string;
  firstName: string;
  window: Window;
  upsetIds: Set<string>;
}

export interface RoomCandidate {
  id: string;
  name: string;
  domain: Domain;
  year: number | null;
  yearEnd: number | null;
  /** 1-based rank inside the pool as scored for this resident, or missing when unknown. */
  ranks: Record<string, number | undefined>;
  poolSize: Record<string, number | undefined>;
}

export interface RoomItem {
  candidate: RoomCandidate;
  minScore: number;
  sumScore: number;
  coverage: number;
  perResident: Record<string, number | null | "n/a" | "veto">;
}

export interface RoomPlan {
  items: RoomItem[];
  excluded: Array<{ id: string; name: string; reason: string }>;
  coverage: Array<{ residentId: string; firstName: string; covered: number; leftOut: boolean }>;
}

const score = (rank: number | undefined, size: number | undefined): number | null => (rank && size ? 1 - (rank - 1) / size : null);

export function planRoom(residents: RoomResident[], candidates: RoomCandidate[], take = 6): RoomPlan {
  if (residents.length < 2 || residents.length > 8) throw new RangeError("a group session needs 2 to 8 residents");
  const need = Math.max(2, Math.ceil(residents.length / 2));
  const excluded: RoomPlan["excluded"] = [];
  const scored: RoomItem[] = [];

  for (const c of candidates) {
    const per: RoomItem["perResident"] = {};
    const known: number[] = [];
    let vetoed = false;
    for (const r of residents) {
      if (r.upsetIds.has(c.id)) {
        per[r.id] = "veto";
        vetoed = true;
        continue;
      }
      if (DATED[c.domain] && (c.year === null || !spanInWindow(r.window, c.year, c.yearEnd))) {
        per[r.id] = "n/a";
        continue;
      }
      const s = score(c.ranks[r.id], c.poolSize[r.id]);
      per[r.id] = s;
      if (s !== null) known.push(s);
    }
    if (vetoed) {
      excluded.push({ id: c.id, name: c.name, reason: "a resident marked this upset" });
      continue;
    }
    if (known.length < need) {
      excluded.push({ id: c.id, name: c.name, reason: `scored for ${known.length} residents, needs ${need}` });
      continue;
    }
    scored.push({ candidate: c, minScore: Math.min(...known), sumScore: known.reduce((a, b) => a + b, 0), coverage: known.length, perResident: per });
  }

  scored.sort((a, b) => b.minScore - a.minScore || b.coverage - a.coverage || b.sumScore - a.sumScore || a.candidate.id.localeCompare(b.candidate.id));
  const items: RoomItem[] = [];
  const perDomain = new Map<Domain, number>();
  for (const s of scored) {
    if (items.length >= take) break;
    const n = perDomain.get(s.candidate.domain) ?? 0;
    if (n >= 3) continue;
    perDomain.set(s.candidate.domain, n + 1);
    items.push(s);
  }

  const coverage = residents.map((r) => {
    const covered = items.filter((i) => {
      const v = i.perResident[r.id];
      return typeof v === "number" && v >= 0.5;
    }).length;
    return { residentId: r.id, firstName: r.firstName, covered, leftOut: covered < 2 };
  });
  return { items, excluded, coverage };
}

/** Converts affinities to 1-based ranks within one pool for one resident. */
export function ranksFromAffinity(entries: Array<{ id: string; affinity: number | null }>): { ranks: Record<string, number>; size: number } {
  const scored = entries.filter((e): e is { id: string; affinity: number } => e.affinity !== null).sort((a, b) => b.affinity - a.affinity);
  const ranks: Record<string, number> = {};
  scored.forEach((e, i) => (ranks[e.id] = i + 1));
  return { ranks, size: scored.length };
}
