// Group session: one pool built from every resident's window, re-scored for each resident with
// filter.results.entities, then chosen by maximin (core/room.ts).
import { memorySignals, type Observation } from "../core/memory.ts";
import { planRoom, ranksFromAffinity, type RoomCandidate, type RoomPlan } from "../core/room.ts";
import type { Domain } from "../core/types.ts";
import { bumpWindow } from "../core/window.ts";
import type { QlooClient } from "../qloo/client.ts";
import type { QlooEntity } from "../qloo/entity.ts";
import type { Params } from "../qloo/guard.ts";
import { DOMAIN_TYPE } from "../qloo/find.ts";
import type { Resident } from "../store/types.ts";

const GROUP_DOMAINS: Domain[] = ["music", "film", "tv"];

export interface GroupInput {
  residents: Array<{ resident: Resident; observations: Observation[] }>;
  currentYear?: number;
  now?: number;
}
export interface GroupResult {
  plan: RoomPlan;
  names: Record<string, string>;
  calls: number;
}

export async function planGroupSession(client: QlooClient, input: GroupInput): Promise<GroupResult> {
  const currentYear = input.currentYear ?? new Date().getUTCFullYear();
  const now = input.now ?? Date.now();
  const rs = input.residents.map(({ resident, observations }) => {
    const mem = memorySignals(observations, now);
    const signals = [...new Set([...resident.favourites.filter((f) => f.confirmed && f.kind === "entity" && f.id).map((f) => f.id as string), ...mem.positive.map((o) => o.entityId)])];
    return { resident, window: bumpWindow(resident.birthYear, resident.offsets, 0, currentYear), signals, upset: new Set(mem.upset.map((o) => o.entityId)) };
  });
  if (rs.some((r) => r.signals.length === 0)) throw new RangeError("every resident needs at least one confirmed favourite");

  const { value, calls } = await client.trace(async () => {
    const pool = new Map<string, { e: QlooEntity; domain: Domain }>();
    for (const domain of GROUP_DOMAINS) {
      for (const r of rs) {
        const p: Params = { "filter.type": DOMAIN_TYPE[domain], "signal.interests.entities": r.signals.join(","), take: 20 };
        if (domain !== "music") {
          p["filter.release_year.min"] = r.window.start;
          p["filter.release_year.max"] = r.window.end;
        }
        const res = await client.insights(p);
        for (const e of res.entities) if (!pool.has(e.id)) pool.set(e.id, { e, domain });
      }
    }
    const ids = [...pool.keys()].slice(0, 60);
    const ranksByResident = new Map<string, { ranks: Record<string, number>; size: number }>();
    for (const domain of GROUP_DOMAINS) {
      const inDomain = ids.filter((id) => pool.get(id)!.domain === domain);
      if (inDomain.length === 0) continue;
      for (const r of rs) {
        const res = await client.insights({ "filter.type": DOMAIN_TYPE[domain], "signal.interests.entities": r.signals.join(","), "filter.results.entities": inDomain.join(",") });
        const got = ranksFromAffinity(res.entities.map((e) => ({ id: e.id, affinity: e.affinity })));
        const prev = ranksByResident.get(r.resident.id);
        ranksByResident.set(r.resident.id, { ranks: { ...(prev?.ranks ?? {}), ...Object.fromEntries(Object.entries(got.ranks).map(([k, v]) => [k, v])) }, size: Math.max(prev?.size ?? 0, got.size) });
      }
    }
    const cands: RoomCandidate[] = ids.map((id) => {
      const { e, domain } = pool.get(id)!;
      const ranks: Record<string, number | undefined> = {};
      const poolSize: Record<string, number | undefined> = {};
      for (const r of rs) {
        const rr = ranksByResident.get(r.resident.id);
        ranks[r.resident.id] = rr?.ranks[id];
        poolSize[r.resident.id] = rr?.size;
      }
      return { id, name: e.name, domain, year: e.year, yearEnd: e.yearEnd, ranks, poolSize };
    });
    const plan = planRoom(rs.map((r) => ({ id: r.resident.id, firstName: r.resident.firstName, window: r.window, upsetIds: r.upset })), cands, 6);
    return { plan, names: Object.fromEntries(cands.map((c) => [c.id, c.name])) };
  });
  return { plan: value.plan, names: value.names, calls: calls.filter((c) => !c.cached).length };
}
