// Invariant 5: model text never introduces an entity name that is not on the card.
import { claimViolations, houseStyleViolations, stripForDisplay } from "./house-style.ts";
import type { CardItem, Opener } from "./types.ts";

export interface OpenerContext {
  /** Names allowed in any opener: card items, the resident's first name, hometown, confirmed favourites. */
  allowedNames: string[];
  /** Every entity name Qloo returned in this build, including rejected ones. */
  knownNames: string[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, name: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(name)}($|[^\\p{L}\\p{N}])`, "iu").test(text);

export function openerViolations(text: string, ctx: OpenerContext): string[] {
  const v = [...houseStyleViolations(text), ...claimViolations(text)];
  if (text.length < 8 || text.length > 180) v.push("length");
  const allowed = new Set(ctx.allowedNames.map((n) => n.toLowerCase()));
  for (const n of ctx.knownNames) {
    if (n.length < 3 || allowed.has(n.toLowerCase())) continue;
    // an allowed name that contains this one (for example a title with a subtitle) is not an intrusion
    if (ctx.allowedNames.some((a) => a.toLowerCase().includes(n.toLowerCase()))) continue;
    if (mentions(text, n)) v.push(`names_off_card:${n}`);
  }
  // multi-word capitalised runs that are not allowed names are treated as unknown entities
  // Allowed names are masked first; a sentence-initial word is not part of a name.
  let masked = text;
  for (const a of [...ctx.allowedNames].sort((x, y) => y.length - x.length)) masked = masked.replace(new RegExp(esc(a), "giu"), "§");
  const runRe = /\b[A-Z][\p{L}'’]+(?:\s+[A-Z][\p{L}'’]+)+/gu;
  for (const m of masked.matchAll(runRe)) {
    let words = m[0].split(/\s+/);
    const at = m.index ?? 0;
    if (at === 0 || /[.?!]\s*$/.test(masked.slice(0, at))) words = words.slice(1);
    if (words.length >= 2) v.push(`names_off_card:${words.join(" ")}`);
  }
  return [...new Set(v)];
}

/** Deterministic line from the entity's own name and year. Labelled "template" wherever it is shown. */
export function templateOpener(item: Pick<CardItem, "name" | "domain" | "year">): string {
  const y = item.year;
  switch (item.domain) {
    case "music":
      return y ? `Do you remember hearing ${item.name} around ${y}?` : `Did you ever hear ${item.name} on the radio?`;
    case "film":
      return y ? `Do you remember seeing ${item.name}, from ${y}?` : `Do you remember seeing ${item.name}?`;
    case "tv":
      return y ? `Did you ever watch ${item.name}, which began in ${y}?` : `Did you ever watch ${item.name}?`;
    case "food":
      return `Does ${item.name} remind you of food from home?`;
    default:
      return `Have you ever been to ${item.name}, or somewhere like it?`;
  }
}

/** Accepts the model's line only if it passes every filter; otherwise the template line, with the reasons. */
export function settleOpener(item: Pick<CardItem, "name" | "domain" | "year">, modelText: string | undefined, ctx: OpenerContext): Opener {
  if (!modelText) return { text: templateOpener(item), source: "template" };
  const cleaned = stripForDisplay(modelText);
  const bad = openerViolations(cleaned, ctx);
  if (bad.length === 0) return { text: cleaned, source: "model" };
  return { text: templateOpener(item), source: "template", blocked: bad };
}
