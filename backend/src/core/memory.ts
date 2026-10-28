// Memory policy: only a carer's tap becomes memory. Positive taps become new signals, upset taps
// suppress the item and down-weight its neighbours. Entries expire after 90 days unless the same item
// is logged again. Upset does not expire on its own, because a painful association should not fade
// by calendar; the family or carer can delete it.
import { POSITIVE, type ObservationValue } from "./types.ts";
import type { Tag } from "../qloo/entity.ts";

export const EXPIRY_DAYS = 90;

export interface Observation {
  id: string;
  residentId: string;
  cardId: string;
  entityId: string;
  entityName: string;
  domain: string;
  tags: Tag[];
  value: ObservationValue;
  note: string | null;
  by: string;
  at: string;
}

const DAY = 86400000;

/** Latest observation per entity, dropping positives older than the expiry. */
export function activeObservations(all: Observation[], now = Date.now()): Observation[] {
  const latest = new Map<string, Observation>();
  for (const o of [...all].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) latest.set(o.entityId, o);
  return [...latest.values()].filter((o) => o.value === "upset" || now - Date.parse(o.at) <= EXPIRY_DAYS * DAY);
}

export interface MemorySignals {
  positive: Observation[];
  upset: Observation[];
  expired: Observation[];
}

export function memorySignals(all: Observation[], now = Date.now()): MemorySignals {
  const active = activeObservations(all, now);
  const activeIds = new Set(active.map((o) => o.entityId));
  const expired = all.filter((o) => !activeIds.has(o.entityId));
  return {
    positive: active.filter((o) => (POSITIVE as string[]).includes(o.value)),
    upset: active.filter((o) => o.value === "upset"),
    expired: [...new Map(expired.map((o) => [o.entityId, o])).values()],
  };
}

/** Multiplier below 1 when a candidate shares at least two tags with an upset item. */
export function neighbourWeight(candidateTags: Tag[], upset: Observation[]): number {
  const mine = new Set(candidateTags.map((t) => t.id));
  let w = 1;
  for (const u of upset) {
    const shared = u.tags.filter((t) => mine.has(t.id)).length;
    if (shared >= 2) w = Math.min(w, 0.5);
  }
  return w;
}
