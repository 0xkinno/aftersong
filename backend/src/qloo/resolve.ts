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

/** First locality Qloo knows for a place name. Sent onward as an id, never as the typed name. */
export async function resolveLocality(client: QlooClient, place: string): Promise<{ id: string; name: string } | null> {
  const s = await client.search(place, "urn:entity:locality", 3);
  const first = s.entities[0];
  return first ? { id: first.id, name: first.name } : null;
}

/** Cuisine tags for a region, for example the food of a hometown. */
export async function resolveCuisineTags(client: QlooClient, region: string): Promise<Tag[]> {
  const r = await client.tags(`${region} cuisine`, 10);
  const cuisine = r.tags.filter((t) => /cuisine/i.test(t.id) || /cuisine/i.test(t.type ?? ""));
  return (cuisine.length ? cuisine : []).slice(0, 3);
}
