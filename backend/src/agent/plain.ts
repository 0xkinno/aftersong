// The counterfactual: the same model with no Qloo suggests items for the same intake, and each
// suggestion is run through the same rules. A suggestion passes only if Qloo knows it, it sits in
// the person's years, and Qloo links it to a confirmed favourite.
import { vetCandidate } from "../core/rules.ts";
import { labelFor } from "../core/classify.ts";
import { DATED, DOMAINS, type Candidate, type Domain, type Window } from "../core/types.ts";
import type { QlooClient } from "../qloo/client.ts";
import { DOMAIN_TYPE } from "../qloo/find.ts";
import type { Resident } from "../store/types.ts";
import type { Model } from "./model.ts";

export interface PlainRow {
  name: string;
  domain: Domain;
  claimedYear: number | null;
  qlooId: string | null;
  year: number | null;
  failures: string[];
  widelyKnown: boolean;
  passes: boolean;
}

export interface PlainResult {
  rows: PlainRow[];
  summary: { total: number; passing: number; outsideWindow: number; notInQloo: number; notConnected: number; widelyKnown: number };
  usage: { inputTokens: number; outputTokens: number };
  raw: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function parsePlainList(text: string): Array<{ name: string; domain: Domain; year: number | null }> {
  const m = /\[[\s\S]*\]/.exec(text);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as Array<{ name?: unknown; domain?: unknown; year?: unknown }>;
    return arr
      .filter((x) => typeof x.name === "string" && DOMAINS.includes(x.domain as Domain))
      .slice(0, 10)
      .map((x) => ({ name: String(x.name), domain: x.domain as Domain, year: typeof x.year === "number" ? x.year : null }));
  } catch {
    return [];
  }
}

export async function runPlainAi(deps: { client: QlooClient; model: Model }, resident: Resident, window: Window): Promise<PlainResult> {
  const favs = resident.favourites.filter((f) => f.confirmed && f.id);
  const prompt = `A carer needs eight things to talk about in a reminiscence session with a resident born in ${resident.birthYear}, who grew up in ${resident.hometown}. Their favourites: ${favs.map((f) => f.name).join(", ")}. Suggest eight items across music, film, tv, food and place. Reply with only a JSON array of objects with name, domain (music, film, tv, food or place) and year.`;
  const reply = await deps.model.complete("You suggest items for a reminiscence session. Reply with JSON only.", [{ role: "user", text: prompt }], []);
  const list = parsePlainList(reply.text);
  const rows: PlainRow[] = [];
  const taken = new Set<string>();
  const favIds = favs.map((f) => f.id as string);
  const seen = new Set<string>(favIds);

  for (const it of list) {
    const type = DOMAIN_TYPE[it.domain];
    const failures: string[] = [];
    let qlooId: string | null = null;
    let year: number | null = null;
    let widelyKnown = false;
    const s = await deps.client.search(it.name, type, 5).catch(() => ({ entities: [] }));
    const hit = s.entities.find((e) => norm(e.name) === norm(it.name));
    if (!hit) failures.push("not_qloo_entity");
    else {
      qlooId = hit.id;
      seen.add(hit.id);
      const d = await deps.client.entities([hit.id]).catch(() => ({ entities: [] }));
      const detail = d.entities.find((e) => e.id === hit.id) ?? hit;
      let affinity: number | null = null;
      if (favIds.length) {
        const r = await deps.client
          .insights({ "filter.type": type, "signal.interests.entities": favIds.join(","), "filter.results.entities": hit.id, "feature.explainability": true })
          .catch(() => ({ entities: [] }));
        const e = r.entities.find((x) => x.id === hit.id);
        affinity = e ? (e.affinity ?? 0) : null;
      }
      const cand: Candidate = {
        ...detail,
        domain: it.domain,
        personalAffinity: affinity,
        cohortAffinity: null,
        personalRank: affinity !== null ? 1 : null,
        cohortRank: null,
        signalIds: affinity !== null ? favIds : [],
        callIds: [],
      };
      year = cand.year;
      widelyKnown = labelFor(cand).label === "widely_known";
      const f = vetCandidate(cand, { window, confirmedIds: new Set(favIds), positiveIds: new Set(), upsetIds: new Set(), seenIds: seen }, taken);
      failures.push(...f.map((x) => x.rule));
      taken.add(hit.id);
    }
    rows.push({ name: it.name, domain: it.domain, claimedYear: it.year, qlooId, year, failures, widelyKnown, passes: failures.length === 0 });
  }
  const count = (rule: string) => rows.filter((r) => r.failures.includes(rule)).length;
  return {
    rows,
    summary: {
      total: rows.length,
      passing: rows.filter((r) => r.passes).length,
      outsideWindow: count("outside_window") + count("era_unknown"),
      notInQloo: count("not_qloo_entity"),
      notConnected: count("not_connected"),
      widelyKnown: rows.filter((r) => r.widelyKnown).length,
    },
    usage: reply.usage,
    raw: reply.text,
  };
}

export { DATED };
