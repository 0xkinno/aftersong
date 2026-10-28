import type { Window } from "./types.ts";

export interface BumpOffsets {
  from: number;
  to: number;
}
export const DEFAULT_OFFSETS: BumpOffsets = { from: 10, to: 30 };

/** Window of the years a person was `from` to `to` years old, adjustable between 5 and 35. */
export function bumpWindow(birthYear: number, offsets: BumpOffsets = DEFAULT_OFFSETS, widenBy = 0, currentYear = new Date().getUTCFullYear()): Window {
  if (!Number.isInteger(birthYear) || birthYear < 1880 || birthYear > currentYear) throw new RangeError("birth year out of range");
  const { from, to } = offsets;
  if (!(from >= 5 && to <= 35 && from < to)) throw new RangeError("window offsets must satisfy 5 <= from < to <= 35");
  if (!Number.isInteger(widenBy) || widenBy < 0 || widenBy > 10) throw new RangeError("widen must be 0 to 10 years");
  const start = birthYear + from - widenBy;
  const end = Math.min(birthYear + to + widenBy, currentYear);
  return { start, end };
}

export const inWindow = (w: Window, year: number): boolean => year >= w.start && year <= w.end;

/** A run overlaps the window when it began by the window's end and had not finished before its start. */
export function spanInWindow(w: Window, year: number, yearEnd: number | null): boolean {
  return year <= w.end && (yearEnd ?? year) >= w.start;
}
