"use client";
import { use, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import SessionMode from "@/components/SessionMode";
import { api } from "@/lib/client";
import { cacheCard, readCachedCard } from "@/lib/offline";
import type { SessionCard } from "@/lib/types";

function Run({ cardId }: { cardId: string }) {
  const [card, setCard] = useState<SessionCard | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([api<SessionCard>(`/cards/${cardId}`, { auth: true }), api<{ session: { currentIndex: number; status: string } | null }>(`/cards/${cardId}/session`, { auth: true })])
      .then(([c, s]) => {
        setCard(c);
        cacheCard(cardId, c);
        setStart(s.session && s.session.status === "in_progress" ? s.session.currentIndex : 0);
      })
      .catch((e) => {
        const cached = readCachedCard<SessionCard>(cardId);
        if (cached) {
          setCard(cached);
          setStart(0);
        } else setErr(e.message);
      });
  }, [cardId]);
  if (err) return <div className="wrap py-16"><p role="alert" style={{ color: "var(--clay-text)" }}>{err}</p></div>;
  if (!card || start === null) return <p className="wrap py-16 text-ink-2">Loading</p>;
  return (
    <SessionMode
      card={card}
      startIndex={start}
      tapPath={`/cards/${cardId}/observations`}
      auth
      backHref={`/app/resident/${card.residentId}`}
      onProgress={(index, finished) => {
        api(`/cards/${cardId}/session`, { method: "PUT", auth: true, body: { currentIndex: index, finished } }).catch(() => undefined);
      }}
    />
  );
}

export default function Page({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = use(params);
  return (
    <AuthGate>
      <Run cardId={cardId} />
    </AuthGate>
  );
}
