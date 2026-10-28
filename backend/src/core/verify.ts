// Offline verifier: recomputes the six invariants from a stored card and the evidence it was built
// from. It calls neither Qloo nor a model, so anyone can run it from a clean clone.
import { assertSafeParams, type Params } from "../qloo/guard.ts";
import { openerViolations } from "./openers.ts";
import { DATED, type SessionCard } from "./types.ts";
import { bumpWindow, spanInWindow, type BumpOffsets } from "./window.ts";

export interface Evidence {
  birthYear: number;
  offsets: BumpOffsets;
  currentYear: number;
  confirmedIds: string[];
  positiveIds: string[];
  upsetIds: string[];
  entities: Record<string, { name: string; year: number | null; yearEnd: number | null }>;
  seenNames: string[];
  allowedNames: string[];
  requests: Array<{ path: string; params: Params }>;
}

export interface Check {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  ok: boolean;
  failures: string[];
}

export function verifyCard(card: SessionCard, ev: Evidence): { ok: boolean; checks: Check[] } {
  const checks: Check[] = [];
  const add = (n: Check["n"], name: string, failures: string[]) => checks.push({ n, name, ok: failures.length === 0, failures });

  add(1, "every item has a Qloo entity id that appears in the stored responses", card.items.flatMap((i) => {
    const e = ev.entities[i.entityId];
    if (!i.entityId) return [`${i.name}: no entity id`];
    if (!e) return [`${i.name}: id ${i.entityId} not found in stored responses`];
    return e.name !== i.name ? [`${i.name}: stored name is "${e.name}"`] : [];
  }));

  const w = bumpWindow(ev.birthYear, ev.offsets, card.widenedBy, ev.currentYear);
  const f2: string[] = [];
  if (w.start !== card.window.start || w.end !== card.window.end) f2.push(`card window ${card.window.start}-${card.window.end} differs from recomputed ${w.start}-${w.end}`);
  for (const i of card.items) {
    if (!DATED[i.domain]) continue;
    const e = ev.entities[i.entityId];
    if (!e || e.year === null) f2.push(`${i.name}: no stored year`);
    else if (!spanInWindow(w, e.year, e.yearEnd)) f2.push(`${i.name}: ${e.year} is outside ${w.start}-${w.end}`);
    else if (i.year !== e.year) f2.push(`${i.name}: card year ${i.year} differs from stored ${e.year}`);
  }
  add(2, "dated items sit inside the bump window", f2);

  const known = new Set([...ev.confirmedIds, ...ev.positiveIds]);
  add(3, "every item traces to a confirmed favourite or confirmed reaction", card.items.filter((i) => !known.has(i.connectedTo.id)).map((i) => `${i.name}: connected to ${i.connectedTo.id}, which is not confirmed`));

  const upset = new Set(ev.upsetIds);
  add(4, "no suppressed item appears", card.items.filter((i) => upset.has(i.entityId)).map((i) => `${i.name}: marked upset earlier`));

  const allowedNames = [...card.items.map((i) => i.name), ...ev.allowedNames];
  add(5, "openers name nothing that is not on the card", card.items.flatMap((i) => openerViolations(i.opener.text, { allowedNames, knownNames: ev.seenNames }).map((v) => `${i.name}: ${v}`)));

  const f6: string[] = [];
  for (const r of ev.requests) {
    try {
      assertSafeParams(r.path, r.params);
    } catch (e) {
      f6.push(`${r.path}: ${(e as Error).message}`);
    }
  }
  add(6, "Qloo received only ids, tags, years, an age bracket and a place", f6);

  return { ok: checks.every((c) => c.ok), checks };
}
