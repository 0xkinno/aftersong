import facts from "@/lib/facts.json";

type SetFacts = {
  forms: number; cardsBuilt: number; cardsThin: number; errors: number; aftersongItems: number;
  personalRatePct: number | null; genericOverlapPct: number | null; plainAiItems: number;
  plainAiPassingRulesPct: number | null; plainAiOutsideYearsPct: number | null; plainAiNotInQlooPct: number | null; plainAiNotConnectedPct: number | null;
  meanLiveQlooCallsPerCard: number | null; meanBuildSeconds: number | null;
} | null;

const f = (v: number | null, unit = "%") => (v === null ? "Not measured yet" : `${v}${unit}`);

export default function FactsPanel() {
  const c = (facts as unknown as { curated: SetFacts }).curated;
  const w = (facts as unknown as { wild: SetFacts }).wild;
  const row = (label: string, s: SetFacts) => (
    <tr>
      <th scope="row" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "inherit", fontSize: 16, color: "var(--ink)" }}>{label}</th>
      <td>{s ? `${s.cardsBuilt} of ${s.forms} cards built` : "Not run yet"}</td>
      <td>{f(s?.plainAiPassingRulesPct ?? null)}</td>
      <td>{f(s?.plainAiOutsideYearsPct ?? null)}</td>
      <td>{f(s?.plainAiNotInQlooPct ?? null)}</td>
      <td>{f(s?.personalRatePct ?? null)}</td>
    </tr>
  );
  return (
    <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto">
      <table>
        <caption className="text-left kicker mb-2">Plain AI list, run through the same rules as the card. Numbers come from docs/FACTS.json.</caption>
        <thead><tr><th>Set</th><th>Aftersong</th><th>Plain AI passing</th><th>Outside the years</th><th>Not in Qloo</th><th>Personal items on the card</th></tr></thead>
        <tbody>{row("Curated forms", c)}{row("Wild forms", w)}</tbody>
      </table>
    </div>
  );
}
