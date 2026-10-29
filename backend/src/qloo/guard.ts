// Invariant 6: Qloo receives only entity IDs, tag IDs, an age bracket, years, a locality ID or a
// coordinate point, plus entity names for /search. Everything else is refused before it leaves.

export type Params = Record<string, string | number | boolean | undefined>;

const ID = /^[A-Za-z0-9-]{6,64}$/;
const TAG = /^urn:tag:[A-Za-z0-9_.:\-]+$/;
const TYPE = /^urn:entity:[a-z_]+$/;
const AGE = /^(24_and_younger|25_to_29|30_to_34|35_to_44|45_to_54|55_and_older)$/;
const POINT = /^POINT\(-?\d{1,3}(\.\d+)? -?\d{1,2}(\.\d+)?\)$/;

const idList = (v: string) => v.split(",").every((s) => ID.test(s)) && v.split(",").length <= 60;
const tagList = (v: string) => v.split(",").every((s) => TAG.test(s)) && v.split(",").length <= 30;
const int = (v: string) => /^\d{1,4}$/.test(v);

const INSIGHTS: Record<string, (v: string) => boolean> = {
  "filter.type": (v) => TYPE.test(v) || v === "urn:tag",
  "signal.interests.entities": idList,
  "signal.interests.tags": tagList,
  "signal.demographics.age": (v) => v.split(",").every((s) => AGE.test(s)),
  "signal.location": (v) => POINT.test(v) || ID.test(v),
  "filter.results.entities": idList,
  "filter.exclude.entities": idList,
  "filter.tags": tagList,
  "filter.exclude.tags": tagList,
  "filter.release_year.min": int,
  "filter.release_year.max": int,
  "filter.popularity.max": (v) => /^(0(\.\d+)?|1(\.0+)?)$/.test(v),
  "filter.popularity.min": (v) => /^(0(\.\d+)?|1(\.0+)?)$/.test(v),
  "filter.date_of_birth.min": (v) => /^\d{4}(-\d{2}-\d{2})?$/.test(v),
  "filter.date_of_birth.max": (v) => /^\d{4}(-\d{2}-\d{2})?$/.test(v),
  "feature.explainability": (v) => v === "true",
  take: (v) => /^([1-9]|[1-4]\d|50)$/.test(v), // measured: the API refuses take above 50
  offset: (v) => /^\d{1,4}$/.test(v),
};

const SEARCH: Record<string, (v: string) => boolean> = {
  query: (v) => v.length >= 1 && v.length <= 80 && !/[@\n\r<>]/.test(v) && !/\d{6,}/.test(v),
  types: (v) => v.split(",").every((s) => TYPE.test(s)),
  take: (v) => /^\d{1,2}$/.test(v),
};

const TAGS: Record<string, (v: string) => boolean> = {
  "filter.query": SEARCH.query,
  "feature.semantic_search": (v) => v === "true",
  "filter.tag.types": (v) => /^[A-Za-z0-9_:.,\-]{1,200}$/.test(v),
  take: (v) => /^\d{1,2}$/.test(v),
};

const ENTITIES: Record<string, (v: string) => boolean> = { entity_ids: idList };

const DATE = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const COMPARE: Record<string, (v: string) => boolean> = {
  "a.signal.interests.entities": idList,
  "b.signal.interests.entities": idList,
  "filter.type": (v) => TYPE.test(v),
  take: (v) => /^\d{1,2}$/.test(v),
};
const TRENDING: Record<string, (v: string) => boolean> = {
  "filter.type": (v) => TYPE.test(v),
  "filter.start_date": DATE,
  "filter.end_date": DATE,
  "signal.interests.entities": idList,
  take: (v) => /^\d{1,2}$/.test(v),
};
const AUDIENCES: Record<string, (v: string) => boolean> = {
  "filter.audience.types": (v) => /^[A-Za-z0-9_:.,-]{1,200}$/.test(v),
  "filter.parents.types": (v) => /^[A-Za-z0-9_:.,-]{1,200}$/.test(v),
  take: (v) => /^\d{1,2}$/.test(v),
};

const BY_PATH: Record<string, Record<string, (v: string) => boolean>> = {
  "/v2/insights": INSIGHTS,
  "/search": SEARCH,
  "/v2/tags": TAGS,
  "/entities": ENTITIES,
  "/v2/analysis/compare": COMPARE,
  "/v2/trending": TRENDING,
  "/v2/audiences": AUDIENCES,
};

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

/** Throws when a request would send anything outside the allowlist. */
export function assertSafeParams(path: string, params: Params): void {
  const rules = BY_PATH[path];
  if (!rules) throw new GuardError(`path ${path} is not allowed`);
  for (const [k, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const rule = rules[k];
    if (!rule) throw new GuardError(`parameter ${k} is not allowed on ${path}`);
    if (!rule(String(raw))) throw new GuardError(`value for ${k} is not allowed on ${path}`);
  }
  if (path === "/v2/insights") {
    // signal.location is a hard filter on a pinned pool: most items vanish. Open queries only.
    if (params["signal.location"] !== undefined && params["filter.results.entities"] !== undefined) throw new GuardError("signal.location must not be combined with filter.results.entities");
    // Location was measured to act on places, not films. Never use it to localise anything else.
    const t = String(params["filter.type"] ?? "");
    if (params["signal.location"] !== undefined && t !== "urn:entity:place" && t !== "urn:entity:destination") throw new GuardError("signal.location is only allowed for places and destinations");
  }
}
