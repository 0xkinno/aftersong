"use client";
import { useCallback, useEffect, useState } from "react";
import BuildTrail from "./BuildTrail";
import CardView from "./CardView";
import { api, streamCard, ApiError } from "@/lib/client";
import type { SessionCard, TrailEvent } from "@/lib/types";

interface SampleResident {
  id: string;
  firstName: string;
  birthYear: number;
  hometown: string;
  careCity: string;
  favourites: Array<{ text: string; confirmed: boolean; name: string | null }>;
}

export default function SampleExplorer({ initialId = "sample-walter" }: { initialId?: string }) {
  const [residents, setResidents] = useState<SampleResident[] | null>(null);
  const [id, setId] = useState(initialId);
  const [card, setCard] = useState<SessionCard | null>(null);
  const [trail, setTrail] = useState<TrailEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ residents: SampleResident[] }>("/sample/residents")
      .then((r) => setResidents(r.residents))
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCard(null);
    setTrail([]);
    api<{ card: SessionCard | null }>(`/sample/residents/${id}/card`)
      .then((r) => setCard(r.card))
      .catch(() => setCard(null));
  }, [id]);

  const build = useCallback(async () => {
    setRunning(true);
    setError(null);
    setTrail([]);
    try {
      const r = await streamCard(`/sample/residents/${id}/card`, {}, false, { onTrail: (e) => setTrail((t) => [...t, e]) });
      setCard(r.card);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [id]);

  const r = residents?.find((x) => x.id === id);

  return (
    <div className="wrap py-10">
      <p className="kicker no-print">Sample</p>
      <h1 className="text-40 md:text-64 no-print">Try a sample resident</h1>
      <p className="mt-3 max-w-2xl text-ink-2 no-print">These residents are samples, shown with their intake and no personal data. The cards are built by the real agent from real Qloo results. Nothing here is saved.</p>

      {loading && <p className="mt-8 text-ink-2">Loading</p>}
      {error && <p role="alert" className="card p-4 mt-6" style={{ color: "var(--clay-text)" }}>{error}</p>}

      {residents && (
        <div className="mt-8 grid gap-6 md:grid-cols-[320px_1fr] print-single">
          <div className="no-print">
            <label htmlFor="who">Sample resident</label>
            <select id="who" value={id} onChange={(e) => setId(e.target.value)}>
              {residents.map((x) => <option key={x.id} value={x.id}>{x.firstName}, born {x.birthYear}</option>)}
            </select>
            {r && (
              <div className="card p-4 mt-4 text-14">
                <p className="kicker">Intake</p>
                <p className="mt-2">Born {r.birthYear}. Grew up in {r.hometown}. Lives in {r.careCity}.</p>
                <p className="mt-2">Favourites: {r.favourites.map((f) => f.name ?? f.text).join(", ")}.</p>
                {r.favourites.some((f) => !f.confirmed) && <p className="mt-2 text-ink-2">Some favourites did not match one Qloo entity and are not used.</p>}
              </div>
            )}
            <div className="mt-4 grid gap-3">
              {!card && <button className="btn btn-primary" disabled={running} onClick={build}>{running ? "Building" : "Build this card live"}</button>}
              <p className="text-12 text-ink-2">Live builds are limited per visitor and per day so the public link cannot spend the Qloo quota.</p>
              {card && <a className="btn" href={`/sample/${id}/session`}>Run the session on a phone</a>}
              {card && <a className="btn" href={`/compare?r=${id}`}>Compare with a plain AI list</a>}
              {card && <a className="btn" href={`/api/sample/cards/${card.id}/export`} download={`${card.id}.json`}>Download for the offline verifier</a>}
            </div>
          </div>
          <div>
            {(running || trail.length > 0) && <div className="mb-6 no-print"><BuildTrail events={trail.length ? trail : card?.trail ?? []} running={running} /></div>}
            {card && <CardView card={card} sample residentName={r?.firstName} />}
            {!card && !running && !error && <p className="card p-6 text-ink-2">No saved card for this sample yet. Build it live to see the agent work.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
