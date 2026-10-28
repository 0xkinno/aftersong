"use client";
import { useEffect, useState } from "react";
import CardView from "./CardView";
import { api } from "@/lib/client";
import type { SessionCard } from "@/lib/types";

interface Row { name: string; domain: string; claimedYear: number | null; qlooId: string | null; year: number | null; failures: string[]; widelyKnown: boolean; passes: boolean }
interface Plain { rows: Row[]; summary: { total: number; passing: number; outsideWindow: number; notInQloo: number; notConnected: number; widelyKnown: number } }

const WHY: Record<string, string> = {
  not_qloo_entity: "Qloo has no entity with this name",
  outside_window: "Outside the years that matter",
  era_unknown: "Qloo gives no year for it",
  not_connected: "Qloo does not link it to the favourites",
  is_seed: "It is a favourite already",
  duplicate: "Repeated",
};

export default function CompareView({ residentId, sample = true }: { residentId: string; sample?: boolean }) {
  const [card, setCard] = useState<SessionCard | null>(null);
  const [plain, setPlain] = useState<Plain | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ card: SessionCard | null }>(`/sample/residents/${residentId}/card`).then((r) => setCard(r.card)).catch(() => undefined);
  }, [residentId]);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ plain: Plain }>(`/sample/residents/${residentId}/compare`, { method: "POST", body: {} });
      setPlain(r.plain);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!plain && (
        <div className="card p-5 mb-6">
          <p>The same model, with no Qloo, suggests eight items for the same intake. Each one is then checked against the same rules as the card.</p>
          <button className="btn btn-primary mt-4" onClick={run} disabled={busy}>{busy ? "Checking each item against Qloo" : "Run the plain AI list now"}</button>
          <p className="text-12 text-ink-2 mt-2">Live and limited per visitor. About twenty Qloo calls.</p>
        </div>
      )}
      {err && <p role="alert" className="card p-4 mb-6" style={{ color: "var(--clay-text)" }}>{err}</p>}
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="What a plain AI suggested">
          <p className="kicker">What a plain AI suggested</p>
          {plain ? (
            <>
              <p className="mt-2 text-28 font-display">{plain.summary.passing} of {plain.summary.total} pass the same rules</p>
              <p className="text-14 text-ink-2 mt-1">{plain.summary.outsideWindow} outside the years, {plain.summary.notInQloo} not in Qloo, {plain.summary.notConnected} not linked to the favourites, {plain.summary.widelyKnown} widely known.</p>
              <ul className="grid gap-3 mt-4" style={{ listStyle: "none", padding: 0 }}>
                {plain.rows.map((r, i) => (
                  <li key={i} className="card p-4">
                    <div className="flex justify-between gap-2">
                      <span className="kicker">{r.domain}{r.year ? `  ${r.year}` : r.claimedYear ? `  claimed ${r.claimedYear}` : ""}</span>
                      <span className={`tag ${r.passes ? "tag-shared" : "tag-known"}`}>{r.passes ? "Passes" : "Fails"}</span>
                    </div>
                    <p className="text-20 font-display mt-1">{r.name}</p>
                    {r.failures.length > 0 && <p className="text-14 text-ink-2 mt-1">{r.failures.map((f) => WHY[f] ?? f).join("; ")}</p>}
                    {r.widelyKnown && <p className="text-12 mono text-ink-2 mt-1">Widely known</p>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="card p-5 mt-2 text-ink-2">Run the list to see it here.</p>
          )}
        </section>
        <section aria-label="The Aftersong card">
          {card ? <CardView card={card} sample={sample} /> : <p className="card p-5 text-ink-2">No saved card for this sample yet. Build it on the sample page first.</p>}
        </section>
      </div>
    </div>
  );
}
