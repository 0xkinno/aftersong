// Cross-domain strength differs by type: music, film and TV anchors move each other strongly, and place
// anchors barely move films. So signals are routed by domain. A dish is never sent as a signal for films.
import type { Observation } from "./memory.ts";
import type { Favourite } from "./types.ts";

export interface Route {
  entityIds: string[];
  tagIds: string[];
}
export interface Routes {
  media: Route;
  food: Route;
}

const MEDIA = /artist|movie|tv_show|person|book|video_game|podcast|actor|director|author|music/i;
const FOOD = /place|brand|destination|locality|restaurant|food/i;

export function favouriteRoute(f: Pick<Favourite, "kind" | "id" | "type">): "media" | "food" {
  if (f.kind === "tag") return f.id && /:cuisine|:food|:dish/i.test(f.id) ? "food" : "media";
  if (f.type && FOOD.test(f.type) && !MEDIA.test(f.type)) return "food";
  return "media";
}

export function observationRoute(domain: string): "media" | "food" {
  return domain === "food" || domain === "place" ? "food" : "media";
}

export function routeSignals(confirmed: Favourite[], positives: Observation[]): Routes {
  const r: Routes = { media: { entityIds: [], tagIds: [] }, food: { entityIds: [], tagIds: [] } };
  const add = (to: Route, kind: "entity" | "tag", id: string) => {
    const list = kind === "tag" ? to.tagIds : to.entityIds;
    if (!list.includes(id)) list.push(id);
  };
  for (const f of confirmed) if (f.id && (f.kind === "entity" || f.kind === "tag")) add(r[favouriteRoute(f)], f.kind, f.id);
  for (const o of positives) add(r[observationRoute(o.domain)], "entity", o.entityId);
  return r;
}
