import type { Transport } from "../src/qloo/client.ts";

// SYNTHETIC Qloo stand-in. Entities are made up; this is test data, not a Qloo response.
export const mockQloo: Transport = async (url) => {
  const p = url.searchParams;
  const body = (results: unknown) => ({ status: 200, headers: { get: () => null }, json: async () => results });
  if (url.pathname === "/search") {
    const q = p.get("query") ?? "";
    if (p.get("types") === "urn:entity:locality") return body({ results: [{ entity_id: `SYN-LOC-${q.length}`, name: q, types: ["urn:entity:locality"] }] });
    return body({ results: [{ entity_id: "SYN-FAV-001", name: q, types: ["urn:entity:artist"] }] });
  }
  if (url.pathname === "/v2/tags") return body({ results: { tags: [{ id: "urn:tag:cuisine:synthetic", name: "Synthetic cuisine", type: "urn:tag:cuisine" }] } });
  if (url.pathname === "/v2/insights") {
    const type = p.get("filter.type") ?? "";
    const short = type.split(":").pop();
    const cohort = p.has("signal.demographics.age");
    const only = p.get("filter.results.entities")?.split(",");
    const min = Number(p.get("filter.release_year.min") ?? 1950);
    const ids = Array.from({ length: 10 }, (_, i) => i);
    const order = cohort ? [...ids].reverse().map((i) => (i + 3) % 10) : ids;
    const list = order
      .map((i, rank) => ({
        entity_id: `SYN-${short}-${i}`,
        name: `Synthetic ${short} ${i}`,
        type,
        popularity: 0.2 + i * 0.01,
        properties: short === "movie" || short === "tv_show" ? { release_year: min + i } : {},
        tags: short === "artist" ? [{ id: "urn:tag:era:1960s", name: "1960s" }] : [],
        query: { affinity: 0.9 - rank * 0.07 },
      }))
      .filter((e) => !only || only.includes(e.entity_id))
      .filter((e) => !(short === "artist" && false));
    return body({ results: { entities: list } });
  }
  return { status: 404, headers: { get: () => null }, json: async () => ({}) };
};
