import type { QlooEntity, Tag } from "../qloo/entity.ts";

export type Domain = "music" | "film" | "tv" | "food" | "place";
export const DOMAINS: Domain[] = ["music", "film", "tv", "food", "place"];
/** Dated domains are held to the bump window. Food and place are tied to a hometown instead. */
export const DATED: Record<Domain, boolean> = { music: true, film: true, tv: true, food: false, place: false };

export type Label = "personal" | "shared_era" | "widely_known";
export type ObservationValue = "lit_up" | "sang_or_moved" | "talked" | "no_response" | "upset" | "skipped";
export const OBSERVATION_VALUES: ObservationValue[] = ["lit_up", "sang_or_moved", "talked", "no_response", "upset", "skipped"];
export const POSITIVE: ObservationValue[] = ["lit_up", "sang_or_moved"];

export interface Window {
  start: number;
  end: number;
}

export interface Favourite {
  text: string;
  kind: "entity" | "tag" | "unresolved";
  id: string | null;
  name: string | null;
  type: string | null;
  confirmed: boolean;
  reason?: string;
}

export interface Candidate extends QlooEntity {
  domain: Domain;
  personalAffinity: number | null;
  cohortAffinity: number | null;
  personalRank: number | null;
  cohortRank: number | null;
  /** Signals used by the calls that scored this item. */
  signalIds: string[];
  /** The signal Qloo reports as the strongest driver, when explainability says. */
  driverId: string | null;
  callIds: string[];
}

export interface RuleFailure {
  rule: "not_qloo_entity" | "is_seed" | "duplicate" | "era_unknown" | "outside_window" | "not_connected" | "suppressed_upset" | "wrong_domain";
  detail?: string;
}

export interface Rejection {
  entityId: string;
  name: string;
  domain: Domain;
  failures: RuleFailure[];
}

export interface Opener {
  text: string;
  source: "model" | "template";
  blocked?: string[];
}

export interface CardItem {
  entityId: string;
  name: string;
  domain: Domain;
  type: string | null;
  year: number | null;
  label: Label;
  cohortUnknown: boolean;
  popularity: number | null;
  personalAffinity: number | null;
  cohortAffinity: number | null;
  connectedTo: { id: string; name: string; kind: "favourite" | "observation" };
  /** Every confirmed signal the item was scored against. */
  connectedAll: Array<{ id: string; name: string }>;
  /** explainability: Qloo named the driver. all_signals: Qloo scored against all of them and did not say which. */
  connectionBasis: "explainability" | "all_signals";
  tags: Tag[];
  opener: Opener;
  walk?: { fromEntityId: string; fromName: string; fromObservation: ObservationValue };
  callIds: string[];
}

export interface Abstention {
  domain: Domain | "card";
  message: string;
  canWiden: boolean;
}

export interface SessionCard {
  id: string;
  residentId: string;
  createdAt: string;
  window: Window;
  widenedBy: number;
  status: "ok" | "thin";
  items: CardItem[];
  rejections: Rejection[];
  abstentions: Abstention[];
  model: { provider: string; id: string } | null;
  trail: Array<{ at: string; tool: string; summary: string }>;
  calls: Array<{ id: string; path: string; cached: boolean; status: number | null; ms: number; resultCount: number | null }>;
  version: 1;
}
