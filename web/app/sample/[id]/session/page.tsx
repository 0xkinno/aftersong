"use client";
import { use, useEffect, useState } from "react";
import SessionMode from "@/components/SessionMode";
import { api } from "@/lib/client";
import { cacheCard, readCachedCard } from "@/lib/offline";
import type { SessionCard } from "@/lib/types";

export default function SampleSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [card, setCard] = useState<SessionCard | null | undefined>(undefined);
  useEffect(() => {
    api<{ card: SessionCard | null }>(`/sample/residents/${id}/card`)
      .then((r) => {
        setCard(r.card);
        if (r.card) cacheCard(`sample-${id}`, r.card);
      })
      .catch(() => setCard(readCachedCard<SessionCard>(`sample-${id}`)));
  }, [id]);
  if (card === undefined) return <p className="wrap py-16 text-ink-2">Loading</p>;
  if (!card)
    return (
      <div className="wrap py-16">
        <p>No saved card for this sample yet.</p>
        <a className="btn mt-4" href="/sample">Back to the sample</a>
      </div>
    );
  return <SessionMode card={card} sample tapPath="/sample/taps" backHref="/sample" />;
}
