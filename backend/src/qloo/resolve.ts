// Resolves what a family typed into Qloo ids the carer can confirm, and a home city into a locality.
import type { QlooClient } from "./client.ts";
import type { Tag } from "./entity.ts";

export interface Match {
  id: string;
  name: string;
  type: string | null;
  note: string | null;
  kind: "entity" | "tag";
}

export interface Resolution {
  text: string;
  status: "none" | "one" | "several";
  matches: Match[];
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Never picks for the carer. One exact name match is marked "one" so the screen can pre-select it. */
export async function resolveFavourite(client: QlooClient, text: string): Promise<Resolution> {
  const t = text.trim();
  const s = await client.search(t, undefined, 5);
  let matches: Match[] = s.entities.map((e) => ({ id: e.id, name: e.name, type: e.type, note: e.disambiguation, kind: "entity" as const }));
  if (matches.length === 0) {
    const tg = await client.tags(t, 5);
    matches = tg.tags.map((x) => ({ id: x.id, name: x.name, type: x.type, note: x.id, kind: "tag" as const }));
  }
  if (matches.length === 0) return { text: t, status: "none", matches: [] };
  const exact = matches.filter((m) => norm(m.name) === norm(t));
  return { text: t, status: exact.length === 1 ? "one" : "several", matches: exact.length === 1 ? [exact[0] as Match, ...matches.filter((m) => m !== exact[0])] : matches };
}

export interface Locality {
  id: string;
  name: string;
  /** WKT point, lon then lat. Preferred over the id: a locality id can return nothing for places. */
  point: string | null;
}

/**
 * Picks the locality whose ancestors match the region the user typed ("San Antonio, Texas" must not
 * resolve to a village in Mexico that happens to be named San Antonio Texas). Falls back to Qloo's
 * first result when the query names no region.
 */
export function pickLocality(query: string, entities: Array<{ id: string; name: string; ancestors: string[]; point: string | null }>): Locality | null {
  if (entities.length === 0) return null;
  const region = query.split(",").slice(1).join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  const score = (e: { ancestors: string[] }) => {
    const hay = e.ancestors.join(" ").toLowerCase();
    return region.filter((t) => hay.includes(t)).length;
  };
  const best = region.length ? [...entities].sort((a, b) => score(b) - score(a))[0]! : entities[0]!;
  if (region.length && score(best) === 0) return { id: entities[0]!.id, name: entities[0]!.name, point: entities[0]!.point };
  return { id: best.id, name: best.name, point: best.point };
}

/** The locality Qloo knows for a place name. Sent onward as a point or an id, never as the typed name. */
export async function resolveLocality(client: QlooClient, place: string): Promise<Locality | null> {
  const s = await client.search(place, "urn:entity:locality", 5);
  return pickLocality(place, s.entities);
}

/** Cuisine tags for a region, for example the food of a hometown. */
export async function resolveCuisineTags(client: QlooClient, region: string): Promise<Tag[]> {
  const r = await client.tags(`${region} cuisine`, 10);
  const cuisine = r.tags.filter((t) => /cuisine/i.test(t.id) || /cuisine/i.test(t.type ?? ""));
  return (cuisine.length ? cuisine : []).slice(0, 3);
}

const TYPE_PRIORITY = ["artist", "movie", "tv_show", "person", "book", "podcast", "video_game"];
const typeRank = (t: string | null) => {
  const i = TYPE_PRIORITY.findIndex((x) => (t ?? "").endsWith(x));
  return i < 0 ? 99 : i;
};

/**
 * Automatic choice for places where no carer is on screen (sample residents, the eval, the try path).
 * Qloo returns several entities with the same name (an artist, a person and albums; a film and cities).
 * Takes the exact name match, preferring artist, then film, then television. A name with no exact entity
 * falls back to an exact tag (for a dish or a cuisine). Returns null when nothing matches exactly.
 * A carer in the app always chooses by hand.
 */
export async function autoConfirm(client: QlooClient, text: string): Promise<{ id: string; name: string; type: string | null; kind: "entity" | "tag" } | null> {
  const r = await resolveFavourite(client, text);
  const exact = r.matches.filter((m) => m.kind === "entity" && norm(m.name) === norm(text) && typeRank(m.type) < 99).sort((a, b) => typeRank(a.type) - typeRank(b.type));
  if (exact[0]) return { id: exact[0].id, name: exact[0].name, type: exact[0].type, kind: "entity" };
  const tg = await client.tags(text, 8);
  const tag = tg.tags.find((t) => norm(t.name) === norm(text)) ?? null;
  return tag ? { id: tag.id, name: tag.name, type: tag.type, kind: "tag" } : null;
}
