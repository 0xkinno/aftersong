// House style for every string shown to a person, including model output: no dashes used as
// punctuation, no emoji, no hype words. A second filter blocks medical claims.

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
const DASHES = /[‒–—―−]| - /;
export const HYPE = [
  "revolutionary",
  "paradigm",
  "cutting-edge",
  "cutting edge",
  "seamless",
  "world-class",
  "game-changing",
  "groundbreaking",
  "zero-trust",
  "military-grade",
  "proven compliant",
  "nanosecond",
  "state-of-the-art",
  "unparalleled",
  "best-in-class",
];

export function houseStyleViolations(text: string): string[] {
  const v: string[] = [];
  if (EMOJI.test(text)) v.push("emoji");
  if (DASHES.test(text)) v.push("dash");
  const lower = text.toLowerCase();
  for (const w of HYPE) if (lower.includes(w)) v.push(`hype:${w}`);
  return v;
}

const CLAIMS = [
  /\b(will|would|should)\s+(calm|soothe|relax|help|improve|restore|cure|heal|reduce|ease)\b/i,
  /\b(calm|calms|calming|soothe|soothes|soothing)\b/i,
  /\b(cure|cures|treat|treats|treatment|therapy|therapeutic|diagnos\w*|symptom\w*|medicat\w*)\b/i,
  /\b(reduce|reduces|lower|lowers|ease|eases)\s+(agitation|anxiety|stress|confusion)\b/i,
  /\b(improve|improves|boost|boosts|restore|restores)\s+(memory|memories|mood|cognition)\b/i,
  /\b(he|she|they|walter|resident)\s+(will|would)\s+(love|like|enjoy|remember)\b/i,
  /\bguarantee\w*\b/i,
];

export function claimViolations(text: string): string[] {
  return CLAIMS.filter((r) => r.test(text)).map((r) => `claim:${r.source.slice(0, 30)}`);
}

/** Strips characters house style forbids from model output where a repair is safe. */
export function stripForDisplay(text: string): string {
  return text.replace(/[‒-―−]/g, ",").replace(/ - /g, ", ").replace(EMOJI, "").replace(/\s+/g, " ").trim();
}
