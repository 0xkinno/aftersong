// Rules run in code on every Qloo result, even when the same constraint was sent as a filter,
// so each rejection is visible with its reason. Invariants 2, 3 and 4 live here.
import { DATED, type Candidate, type RuleFailure, type Window } from "./types.ts";
import { spanInWindow } from "./window.ts";

export interface RuleContext {
  window: Window;
  confirmedIds: Set<string>;
  positiveIds: Set<string>;
  /** Cuisine tags of the hometown: a valid base for food and places, named in the card as the hometown. */
  hometownIds?: Set<string>;
  upsetIds: Set<string>;
  /** Every entity id that came back from a Qloo call in this build. */
  seenIds: Set<string>;
}

export const nameKey = (c: { name: string; domain: string }) => `${c.domain}|${c.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()}`;

export function vetCandidate(c: Candidate, ctx: RuleContext, taken: Set<string>): RuleFailure[] {
  const f: RuleFailure[] = [];
  if (!c.id || !ctx.seenIds.has(c.id)) f.push({ rule: "not_qloo_entity" });
  if (ctx.confirmedIds.has(c.id)) f.push({ rule: "is_seed" });
  if (taken.has(c.id) || taken.has(nameKey(c))) f.push({ rule: "duplicate" });
  if (ctx.upsetIds.has(c.id)) f.push({ rule: "suppressed_upset" });
  if (DATED[c.domain]) {
    if (c.year === null) f.push({ rule: "era_unknown", detail: "Qloo returned no year for this item" });
    else if (!spanInWindow(ctx.window, c.year, c.yearEnd)) {
      f.push({ rule: "outside_window", detail: `${c.year}${c.yearEnd ? `-${c.yearEnd}` : ""} is outside ${ctx.window.start}-${ctx.window.end}` });
    }
  }
  // abstain on an item whose affinity Qloo did not return, rather than inventing one
  if (c.personalAffinity === null) f.push({ rule: "no_affinity", detail: "Qloo returned no query.affinity for this item" });
  if (c.requireTagIds?.length && !c.tags.some((t) => c.requireTagIds.includes(t.id))) f.push({ rule: "not_connected", detail: "does not carry the hometown cuisine tag" });
  const connected = c.personalAffinity !== null || c.personalRank !== null;
  const viaKnown = c.signalIds.some((s) => ctx.confirmedIds.has(s) || ctx.positiveIds.has(s) || ctx.hometownIds?.has(s));
  if (!connected || !viaKnown) f.push({ rule: "not_connected", detail: "not scored against a confirmed favourite or confirmed reaction" });
  return f;
}
