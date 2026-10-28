// Builds a session card from candidate pools. Pure: no network, no model. The model only writes
// openers afterwards, and those pass openers.ts.
import { labelFor } from "./classify.ts";
import { neighbourWeight, type MemorySignals } from "./memory.ts";
import { nameKey, vetCandidate, type RuleContext } from "./rules.ts";
import { DOMAINS, type Abstention, type Candidate, type CardItem, type Domain, type Favourite, type Rejection, type SessionCard, type Window } from "./types.ts";
import { templateOpener } from "./openers.ts";

export const QUOTA: Record<Domain, number> = { music: 3, film: 2, tv: 1, food: 1, place: 1 };
export const MIN_ITEMS = 6;
export const MAX_ITEMS = 8;
export const MAX_WIDELY_KNOWN = 2;

export interface BuildInput {
  cardId: string;
  residentId: string;
  window: Window;
  widenedBy: number;
  favourites: Favourite[];
  memory: MemorySignals;
  pools: Partial<Record<Domain, Candidate[]>>;
  seenIds: Set<string>;
  model: { provider: string; id: string } | null;
  trail: SessionCard["trail"];
  calls: SessionCard["calls"];
  now?: string;
}

export function buildCard(input: BuildInput): SessionCard {
  const confirmed = input.favourites.filter((f) => f.confirmed && f.id);
  const confirmedIds = new Set(confirmed.map((f) => f.id as string));
  const positiveIds = new Set(input.memory.positive.map((o) => o.entityId));
  const upsetIds = new Set(input.memory.upset.map((o) => o.entityId));
  const ctx: RuleContext = { window: input.window, confirmedIds, positiveIds, upsetIds, seenIds: input.seenIds };
  const nameOf = new Map<string, string>([...confirmed.map((f) => [f.id as string, f.name ?? f.text] as [string, string]), ...input.memory.positive.map((o) => [o.entityId, o.entityName] as [string, string])]);

  const rejections: Rejection[] = [];
  const abstentions: Abstention[] = [];
  const taken = new Set<string>();
  const items: CardItem[] = [];
  let widelyKnown = 0;

  for (const domain of DOMAINS) {
    const pool = input.pools[domain] ?? [];
    const passing: Candidate[] = [];
    for (const c of pool) {
      const failures = vetCandidate(c, ctx, taken);
      if (failures.length) rejections.push({ entityId: c.id, name: c.name, domain, failures });
      else passing.push(c);
    }
    const score = (c: Candidate) => (c.personalAffinity ?? 0) * neighbourWeight(c.tags, input.memory.upset) + (c.personalRank !== null ? 1 / (1 + c.personalRank) : 0) * 0.001;
    passing.sort((a, b) => score(b) - score(a));
    // prefer a mix: personal first, at most one widely known per domain, two per card
    const picked: Candidate[] = [];
    let wkHere = 0;
    for (const c of passing) {
      if (picked.length >= QUOTA[domain]) break;
      const { label } = labelFor(c);
      if (label === "widely_known" && (wkHere >= 1 || widelyKnown >= MAX_WIDELY_KNOWN)) continue;
      if (taken.has(nameKey(c))) continue;
      picked.push(c);
      taken.add(c.id);
      taken.add(nameKey(c));
      if (label === "widely_known") {
        wkHere++;
        widelyKnown++;
      }
    }
    if (picked.length === 0) abstentions.push({ domain, message: "Not enough from these years yet.", canWiden: true });
    for (const c of picked) {
      const { label, cohortUnknown } = labelFor(c);
      const via = c.signalIds.find((s) => positiveIds.has(s)) ?? c.signalIds.find((s) => confirmedIds.has(s)) ?? c.signalIds[0];
      const kind: "favourite" | "observation" = positiveIds.has(via) ? "observation" : "favourite";
      const obs = input.memory.positive.find((o) => o.entityId === via);
      const item: CardItem = {
        entityId: c.id,
        name: c.name,
        domain,
        type: c.type,
        year: c.year,
        label,
        cohortUnknown,
        popularity: c.popularity,
        personalAffinity: c.personalAffinity,
        cohortAffinity: c.cohortAffinity,
        connectedTo: { id: via, name: nameOf.get(via) ?? via, kind },
        tags: c.tags.slice(0, 6),
        opener: { text: "", source: "template" },
        callIds: c.callIds,
        ...(obs ? { walk: { fromEntityId: obs.entityId, fromName: obs.entityName, fromObservation: obs.value } } : {}),
      };
      item.opener = { text: templateOpener(item), source: "template" };
      items.push(item);
    }
  }

  const trimmed = items.slice(0, MAX_ITEMS);
  const status: SessionCard["status"] = trimmed.length >= MIN_ITEMS ? "ok" : "thin";
  if (status === "thin") abstentions.push({ domain: "card", message: "Not enough from these years yet.", canWiden: input.widenedBy < 10 });
  return {
    id: input.cardId,
    residentId: input.residentId,
    createdAt: input.now ?? new Date().toISOString(),
    window: input.window,
    widenedBy: input.widenedBy,
    status,
    items: trimmed,
    rejections,
    abstentions,
    model: input.model,
    trail: input.trail,
    calls: input.calls,
    version: 1,
  };
}
