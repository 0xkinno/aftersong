import type { Transport } from "../src/qloo/client.ts";

// SYNTHETIC Qloo stand-in. Entities are made up; this is test data, not a Qloo response.
export interface MockOptions {
  /** When false, artists carry no year property and no decade tag, so music needs another strategy. */
  artistEra?: boolean;
  /** Records every request URL. */
  seen?: URL[];
}

export function makeMock(o: MockOptions = {}): Transport {
  const artistEra = o.artistEra ?? true;
  return async (url) => {
    o.seen?.push(url);
    const p = url.searchParams;
    const body = (results: unknown) => ({ status: 200, headers: { get: () => null }, json: async () => results });
    if (url.pathname === "/search") {
      const q = p.get("query") ?? "";
      if (p.get("types") === "urn:entity:locality") return body({ results: [{ entity_id: `SYN-LOC-${q.length}`, name: q, types: ["urn:entity:locality"] }] });
      return body({ results: [{ entity_id: "SYN-FAV-001", name: q, types: ["urn:entity:artist"] }] });
    }
    if (url.pathname === "/entities") return body({ results: (p.get("entity_ids") ?? "").split(",").map((id) => ({ entity_id: id, name: `Synthetic ${id}`, type: "urn:entity:movie", properties: { release_year: 1960 } })) });
    if (url.pathname === "/v2/tags") return body({ results: { tags: [{ id: "urn:tag:cuisine:synthetic", name: "Synthetic cuisine", type: "urn:tag:cuisine" }] } });
    if (url.pathname === "/v2/analysis/compare") return body({ results: { tags: [{ name: "Synthetic soul" }, { name: "Synthetic gospel" }] } });
    if (url.pathname === "/v2/insights") {
      const type = p.get("filter.type") ?? "";
      const short = type.split(":").pop() ?? "";
      const cohort = p.has("signal.demographics.age");
      const only = p.get("filter.results.entities")?.split(",");
      const min = Number(p.get("filter.release_year.min") ?? 1950);
      const dobMin = parseInt(p.get("filter.date_of_birth.min") ?? "1920", 10);
      const ids = Array.from({ length: 10 }, (_, i) => i);
      const order = cohort ? [...ids].reverse().map((i) => (i + 3) % 10) : ids;
      if (cohort && !p.has("filter.results.entities") && !p.has("filter.release_year.min") && !p.has("filter.popularity.max") && !p.has("filter.date_of_birth.min")) return { status: 400, headers: { get: () => null }, json: async () => ({ errors: [{ message: "at least one valid signal or filter is required for entity insights" }] }) };
      const list = order
        .map((i, rank) => ({
          entity_id: `SYN-${short.replace("_", "")}-${i}`,
          name: `Synthetic ${short} ${i}`,
          type,
          popularity: 0.2 + i * 0.01,
          properties:
            short === "movie" || short === "tv_show" ? { release_year: min + i } : short === "person" ? { date_of_birth: `${dobMin + 10 + i}-01-01` } : {},
          tags: short === "artist" && artistEra ? [{ id: "urn:tag:era:1960s", name: "1960s" }] : [],
          query: { affinity: 0.9 - rank * 0.07 },
        }))
        .filter((e) => !only || only.includes(e.entity_id));
      return body({ results: { entities: list } });
    }
    return { status: 404, headers: { get: () => null }, json: async () => ({}) };
  };
}

export const mockQloo: Transport = makeMock();
