import type { Favourite } from "../core/types.ts";
import type { BumpOffsets } from "../core/window.ts";

export interface Resident {
  id: string;
  homeId: string;
  firstName: string;
  birthYear: number;
  /** City of the care home, used to find food near the resident now. */
  careCity: string;
  /** Where the resident grew up, for example "Port Harcourt, Nigeria". */
  hometown: string;
  favourites: Favourite[];
  offsets: BumpOffsets;
  consent: boolean;
  intakeBy: "family" | "carer";
  /** Set when the family submits the intake. The carer then cannot edit the family's fields. */
  familySubmittedAt: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  cardId: string;
  residentId: string;
  status: "in_progress" | "finished";
  currentIndex: number;
  startedAt: string;
  updatedAt: string;
}

export interface Digest {
  id: string;
  residentId: string;
  week: string;
  createdAt: string;
  by: "scheduler" | "manual";
  lines: string[];
  counts: Record<string, number>;
}
