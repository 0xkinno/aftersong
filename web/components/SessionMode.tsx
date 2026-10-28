"use client";
import { useState } from "react";
import { DOMAIN_LABEL, OBSERVATIONS, type ObservationValue, type SessionCard } from "@/lib/types";

/** Phone first. One item per screen, large type, big taps. Only the carer's taps are saved. */
export default function SessionMode({ card, startIndex = 0, sample = false, onTap, onProgress, backHref }: { card: SessionCard; startIndex?: number; sample?: boolean; onTap?: (entityId: string, value: ObservationValue, note: string) => Promise<void>; onProgress?: (index: number, finished: boolean) => void; backHref: string }) {
  const [i, setI] = useState(Math.min(startIndex, card.items.length));
  const [logged, setLogged] = useState<Record<string, ObservationValue>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const done = i >= card.items.length;
  const item = card.items[i];

  const go = (n: number) => {
    setI(n);
    setNote("");
    onProgress?.(n, n >= card.items.length);
  };

  const tap = async (v: ObservationValue) => {
    if (!item) return;
    setBusy(true);
    setErr(null);
    try {
      await onTap?.(item.entityId, v, note);
      setLogged((l) => ({ ...l, [item.entityId]: v }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="wrap py-10 max-w-xl">
        <p className="kicker">{sample ? "Sample  " : ""}Session finished</p>
        <h1 className="text-40 mt-2">That is the card.</h1>
        <p className="mt-3 text-ink-2">{Object.keys(logged).length} reaction{Object.keys(logged).length === 1 ? "" : "s"} {sample ? "tapped. In the sample they are not saved." : "saved. The next card starts from what worked."}</p>
        <a className="btn btn-primary mt-6" href={backHref}>Back</a>
      </div>
    );

  return (
    <div className="wrap py-6 max-w-xl">
      <div className="flex items-center justify-between">
        <p className="kicker">{sample ? "Sample  " : ""}{i + 1} of {card.items.length}</p>
        <a href={backHref} className="text-14 underline">Leave</a>
      </div>
      <div className="mt-2 h-1 bg-paper-2" aria-hidden><div className="fill-bar" style={{ width: `${((i + 1) / card.items.length) * 100}%`, transition: "width 250ms ease" }} /></div>
      <article className="mt-8" aria-live="polite">
        <p className="kicker">{DOMAIN_LABEL[item!.domain]}{item!.year ? `  ${item!.year}` : ""}</p>
        <h1 className="text-40 mt-2" style={{ fontSize: "clamp(32px, 9vw, 48px)" }}>{item!.name}</h1>
        <p className="mt-6 font-display" style={{ fontSize: "clamp(24px, 6.5vw, 32px)", lineHeight: 1.25 }}>&ldquo;{item!.opener.text}&rdquo;</p>
        <p className="mt-4 text-14 text-ink-2">Qloo links this to {item!.connectedTo.name} for people with similar taste.</p>
      </article>

      <fieldset className="mt-8">
        <legend className="kicker mb-2">What did you see?</legend>
        <div className="grid grid-cols-2 gap-3">
          {OBSERVATIONS.map((o) => {
            const on = logged[item!.entityId] === o.value;
            return (
              <button key={o.value} className="btn" style={{ minHeight: 64, fontSize: 18, ...(on ? { background: o.value === "upset" ? "var(--clay-text)" : "var(--sage-text)", color: "#fff", borderColor: "transparent" } : {}) }} aria-pressed={on} disabled={busy} onClick={() => tap(o.value)}>
                {o.text}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4">
        <label htmlFor="note">Note (optional, short)</label>
        <input id="note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hummed along to the second verse" />
      </div>
      {err && <p role="alert" className="mt-3" style={{ color: "var(--clay-text)" }}>{err}</p>}
      <div className="mt-8 flex gap-3">
        <button className="btn" disabled={i === 0} onClick={() => go(i - 1)}>Back</button>
        <button className="btn btn-primary flex-1" onClick={() => go(i + 1)}>{i === card.items.length - 1 ? "Finish" : "Next"}</button>
      </div>
    </div>
  );
}
