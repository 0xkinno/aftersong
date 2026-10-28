import type { CardItem } from "./types";

/** A plain search link to a public service. Never an embedded copyrighted file. */
export function playUrl(item: Pick<CardItem, "name" | "domain" | "year">): { href: string; label: string } {
  const q = encodeURIComponent(item.year && item.domain !== "music" ? `${item.name} ${item.year}` : item.name);
  if (item.domain === "food" || item.domain === "place") return { href: `https://www.google.com/maps/search/?api=1&query=${q}`, label: "Find on a map" };
  return { href: `https://www.youtube.com/results?search_query=${q}`, label: "Play" };
}
