"use client";
import { useEffect, useState } from "react";
import CardView from "./CardView";
import { api } from "@/lib/client";
import type { SessionCard } from "@/lib/types";

/** A saved sample card, built earlier by the real agent. If none is saved, it says so. */
export default function LandingCard() {
  const [card, setCard] = useState<SessionCard | null | undefined>(undefined);
  useEffect(() => {
    api<{ card: SessionCard | null }>("/sample/residents/sample-walter/card").then((r) => setCard(r.card)).catch(() => setCard(null));
  }, []);
  if (card === undefined) return <p className="text-ink-2">Loading the sample card</p>;
  if (!card)
    return (
      <div className="card p-6">
        <p>The saved sample card is not available right now. It is built from Qloo results when the service is connected.</p>
        <a className="btn btn-primary mt-4" href="/sample">Open the sample page</a>
      </div>
    );
  return <CardView card={card} sample residentName="Walter" />;
}
