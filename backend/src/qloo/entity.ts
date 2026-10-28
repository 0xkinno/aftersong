// Turns raw Qloo JSON into one stable entity shape. Field paths follow the documented Insights and
// Search responses; anything missing stays null, never zero.

export interface Tag {
  id: string;
  name: string;
  type: string | null;
}

export interface QlooEntity {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  types: string[];
  popularity: number | null;
  year: number | null;
  yearEnd: number | null;
  yearSource: string | null;
  tags: Tag[];
  affinity: number | null;
  explainability: unknown;
  disambiguation: string | null;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function cleanName(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

function yearFromDate(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})/.exec(v.trim());
  return m ? Number(m[1]) : null;
}

/** Year fields in order of trust. */
export function yearOf(props: Record<string, unknown> | null): { year: number | null; yearEnd: number | null; source: string | null } {
  if (!props) return { year: null, yearEnd: null, source: null };
  const order: Array<[string, number | null]> = [
    ["release_year", num(props.release_year)],
    ["release_date", yearFromDate(props.release_date)],
    ["publication_year", num(props.publication_year)],
    ["first_air_date", yearFromDate(props.first_air_date)],
  ];
  const hit = order.find(([, y]) => y !== null && y >= 1000 && y <= 2100);
  const end = num(props.finale_year) ?? num(props.latest_known_year);
  return { year: hit ? (hit[1] as number) : null, yearEnd: end, source: hit ? `property:${hit[0]}` : null };
}

function tagOf(raw: unknown): Tag | null {
  if (typeof raw === "string") return raw.startsWith("urn:tag:") ? { id: raw, name: raw.split(":").pop() ?? raw, type: null } : null;
  const r = asRecord(raw);
  if (!r) return null;
  const id = typeof r.tag_id === "string" ? r.tag_id : typeof r.id === "string" ? r.id : null;
  const name = typeof r.name === "string" ? r.name : id;
  if (!id || !name) return null;
  return { id, name: cleanName(name), type: typeof r.type === "string" ? r.type : null };
}

export function normalizeEntity(raw: unknown): QlooEntity | null {
  const e = asRecord(raw);
  if (!e) return null;
  const id = typeof e.entity_id === "string" ? e.entity_id : typeof e.id === "string" ? e.id : null;
  const nameRaw = typeof e.name === "string" ? e.name : null;
  if (!id || !nameRaw) return null;
  const props = asRecord(e.properties);
  const q = asRecord(e.query);
  const types = Array.isArray(e.types) ? e.types.filter((t): t is string => typeof t === "string") : [];
  const type = typeof e.type === "string" ? e.type : (types.find((t) => t.startsWith("urn:entity:")) ?? types[0] ?? null);
  const y = yearOf(props);
  const tags = (Array.isArray(e.tags) ? e.tags : []).map(tagOf).filter((t): t is Tag => t !== null);
  return {
    id,
    name: cleanName(nameRaw),
    type,
    subtype: typeof e.subtype === "string" ? e.subtype : null,
    types,
    popularity: num(e.popularity),
    year: y.year,
    yearEnd: y.yearEnd,
    yearSource: y.source,
    tags,
    affinity: num(e.affinity) ?? num(q?.affinity),
    explainability: q?.explainability ?? null,
    disambiguation: typeof e.disambiguation === "string" ? e.disambiguation : null,
  };
}

/** Finds the entity list in any of the response shapes seen in the docs. */
export function extractEntities(body: unknown): QlooEntity[] {
  const b = asRecord(body);
  if (!b) return [];
  const results = b.results;
  const list: unknown[] = Array.isArray(results)
    ? results
    : Array.isArray(asRecord(results)?.entities)
      ? (asRecord(results)!.entities as unknown[])
      : Array.isArray(b.entities)
        ? (b.entities as unknown[])
        : [];
  return list.map(normalizeEntity).filter((e): e is QlooEntity => e !== null);
}

export function extractTags(body: unknown): Tag[] {
  const b = asRecord(body);
  if (!b) return [];
  const results = b.results;
  const list: unknown[] = Array.isArray(results)
    ? results
    : Array.isArray(asRecord(results)?.tags)
      ? (asRecord(results)!.tags as unknown[])
      : Array.isArray(b.tags)
        ? (b.tags as unknown[])
        : [];
  return list.map(tagOf).filter((t): t is Tag => t !== null);
}
