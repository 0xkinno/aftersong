"use client";
import { useState } from "react";
import BuildTrail from "./BuildTrail";
import CardView from "./CardView";
import { streamCard } from "@/lib/client";
import type { SessionCard, TrailEvent } from "@/lib/types";

/** A resident born in 1925 with one obscure favourite. The right answer is to abstain, not to pad. */
export const ABSTENTION_PRESET = { birthYear: 1925, careCity: "San Antonio, Texas", hometown: "Dublin, Ireland", favourites: ["Mildred Bailey"] };

export default function AbstentionPreset() {
  const [card, setCard] = useState<SessionCard | null>(null);
  const [trail, setTrail] = useState<TrailEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setCard(null);
    setStopped(null);
    setErr(null);
    setTrail([]);
    try {
      const r = await streamCard("/try", ABSTENTION_PRESET, false, { onTrail: (e) => setTrail((t) => [...t, e]) });
      setCard(r.card);
    } catch (e) {
      const ae = e as { code?: string; message: string };
      if (ae.code === "NEEDS_CONFIRMATION") setStopped("Qloo could not match the favourite to a single entity, so no card was built and nothing was added from a guess.");
      else setErr(ae.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card p-5" data-testid="abstention-preset">
      <p className="kicker">Abstention preset</p>
      <p className="mt-2">A resident born in 1925 with one obscure favourite, {ABSTENTION_PRESET.favourites[0]}. Their years are 1935 to 1955. If Qloo has too little there, the card must say so and add nothing.</p>
      <button className="btn mt-4" style={{ minHeight: 56 }} disabled={running} onClick={run}>{running ? "Asking Qloo" : "Run the abstention preset"}</button>
      {(running || trail.length > 0) && <div className="mt-4"><BuildTrail events={trail} running={running} /></div>}
      {stopped && <p role="status" className="mt-4"><strong>Not enough to build a card.</strong> {stopped}</p>}
      {err && <p role="alert" className="mt-4" style={{ color: "var(--clay-text)" }}>{err}</p>}
      {card && <div className="mt-6"><CardView card={card} sample residentName="Preset" /></div>}
    </div>
  );
}
