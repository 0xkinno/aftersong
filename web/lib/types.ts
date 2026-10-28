export type Domain = "music" | "film" | "tv" | "food" | "place";
export type Label = "personal" | "shared_era" | "widely_known";
export type ObservationValue = "lit_up" | "sang_or_moved" | "talked" | "no_response" | "upset" | "skipped";

export interface CardItem {
  entityId: string;
  name: string;
  domain: Domain;
  year: number | null;
  label: Label;
  cohortUnknown: boolean;
  popularity: number | null;
  connectedTo: { id: string; name: string; kind: "favourite" | "observation" };
  tags: Array<{ id: string; name: string }>;
  opener: { text: string; source: "model" | "template"; blocked?: string[] };
  walk?: { fromEntityId: string; fromName: string; fromObservation: ObservationValue };
}

export interface SessionCard {
  id: string;
  residentId: string;
  createdAt: string;
  window: { start: number; end: number };
  widenedBy: number;
  status: "ok" | "thin";
  items: CardItem[];
  rejections: Array<{ entityId: string; name: string; domain: Domain; failures: Array<{ rule: string; detail?: string }> }>;
  abstentions: Array<{ domain: string; message: string; canWiden: boolean }>;
  model: { provider: string; id: string } | null;
  trail: Array<{ at: string; tool: string; summary: string }>;
  calls: Array<{ id: string; path: string; cached: boolean; status: number | null; ms: number; resultCount: number | null }>;
}

export interface TrailEvent {
  at: string;
  tool: string;
  summary: string;
}

export const DOMAIN_LABEL: Record<Domain, string> = { music: "Music", film: "Film", tv: "Television", food: "Food", place: "Place" };
export const LABEL_TEXT: Record<Label, string> = { personal: "Personal", shared_era: "Shared era", widely_known: "Widely known" };
export const OBSERVATIONS: Array<{ value: ObservationValue; text: string }> = [
  { value: "lit_up", text: "Lit up" },
  { value: "sang_or_moved", text: "Sang or moved" },
  { value: "talked", text: "Talked about it" },
  { value: "no_response", text: "No response" },
  { value: "upset", text: "Upset" },
  { value: "skipped", text: "Skipped" },
];

export const FRIENDLY_TOOL: Record<string, string> = {
  resolve_favourites: "Checking favourites and places",
  find_era_items: "Looking in the right years",
  read_observations: "Reading what worked before",
  build_card: "Placing items under the rules",
  write_openers: "Writing one opener per item",
  agent: "Agent note",
};
