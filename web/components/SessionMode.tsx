"use client";
import { useCallback, useEffect, useState } from "react";
import OfflineSupport from "./OfflineSupport";
import { api } from "@/lib/client";
import { enqueue, flush, isNetworkError, readQueue } from "@/lib/offline";
import { playUrl } from "@/lib/play";
import { DOMAIN_LABEL, OBSERVATIONS, yearLabel, type ObservationValue, type SessionCard } from "@/lib/types";

/**
 * Phone first and one handed. One item per screen, large type, every tap target at least 56 px, the
 * main actions in a bar at the bottom of the screen. Reactions that cannot be sent wait on the phone
 * and are sent when the connection returns. Only the carer's taps are saved.
 */
export default function SessionMode({ card, startIndex = 0, sample = false, tapPath, auth = false, onProgress, backHref }: { card: SessionCard; startIndex?: number; sample?: boolean; tapPath: string; auth?: boolean; onProgress?: (index: number, finished: boolean) => void; backHref: string }) {
  const [i, setI] = useState(Math.min(startIndex, card.items.length));
  const [logged, setLogged] = useState<Record<string, ObservationValue>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [offline, setOffline] = useState(false);
  const done = i >= card.items.length;
  const item = card.items[i];

  const sync = useCallback(async () => {
    const r = await flush((q) => api(q.path, { method: "POST", body: q.body, auth: q.auth }).then(() => undefined));
    setWaiting(r.left);
  }, []);

  useEffect(() => {
    setWaiting(readQueue().length);
    setOffline(!navigator.onLine);
    const on = () => {
      setOffline(false);
      sync();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (navigator.onLine) sync();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [sync]);

  const go = (n: number) => {
    setI(n);
    setNote("");
    onProgress?.(n, n >= card.items.length);
  };

  const tap = async (v: ObservationValue) => {
    if (!item) return;
    setBusy(true);
    setErr(null);
    const body = { entityId: item.entityId, value: v, note: note || null };
    try {
      await api(tapPath, { method: "POST", body, auth });
      setLogged((l) => ({ ...l, [item.entityId]: v }));
      if (readQueue().length) sync();
    } catch (e) {
      if (isNetworkError(e)) {
        setWaiting(enqueue(tapPath, body, auth));
        setLogged((l) => ({ ...l, [item.entityId]: v }));
      } else setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const status = (
    <p role="status" className="text-14 mt-3" aria-live="polite" data-testid="sync-status">
      {offline ? "No connection. Your taps are kept on this phone." : ""}
      {waiting > 0 ? ` ${waiting} waiting to sync.` : ""}
    </p>
  );

  if (done)
    return (
      <div className="wrap py-10 max-w-xl">
        <OfflineSupport />
        <p className="kicker">{sample ? "Sample  " : ""}Session finished</p>
        <h1 className="text-40 mt-2">That is the card.</h1>
        <p className="mt-3 text-ink-2">
          {Object.keys(logged).length} reaction{Object.keys(logged).length === 1 ? "" : "s"} {sample ? "tapped. In the sample they are not saved." : "tapped. The next card starts from what worked."}
        </p>
        {status}
        <a className="btn btn-primary mt-6" style={{ minHeight: 56 }} href={backHref}>Back</a>
      </div>
    );

  const play = playUrl(item!);
  return (
    <div className="wrap py-6 max-w-xl" style={{ paddingBottom: 120 }}>
      <OfflineSupport />
      <div className="flex items-center justify-between">
        <p className="kicker">{sample ? "Sample  " : ""}{i + 1} of {card.items.length}</p>
        <a href={backHref} className="underline text-14 inline-flex items-center" style={{ minHeight: 56, minWidth: 56, justifyContent: "flex-end" }}>Leave</a>
      </div>
      <div className="h-1 bg-paper-2" aria-hidden>
        <div className="fill-bar" style={{ width: `${((i + 1) / card.items.length) * 100}%`, transition: "width 250ms ease" }} />
      </div>
      <article className="mt-8" aria-live="polite">
        <p className="kicker">{DOMAIN_LABEL[item!.domain]}{item!.year ? `  ${yearLabel(item!)}` : ""}</p>
        <h1 className="text-40 mt-2" style={{ fontSize: "clamp(32px, 9vw, 48px)" }}>{item!.name}</h1>
        <p className="mt-6 font-display" style={{ fontSize: "clamp(24px, 6.5vw, 32px)", lineHeight: 1.25 }}>&ldquo;{item!.opener.text}&rdquo;</p>
        <p className="mt-4 text-16">
          <strong>Because of:</strong> {item!.connectionBasis === "explainability" || (item!.connectedAll ?? []).length < 2 ? item!.connectedTo.name : (item!.connectedAll ?? []).map((c) => c.name).join(", ")}
        </p>
        <a className="btn mt-3" style={{ minHeight: 56 }} href={play.href} target="_blank" rel="noopener noreferrer">{play.label}</a>
      </article>

      <fieldset className="mt-8">
        <legend className="kicker mb-2">What did you see?</legend>
        <div className="grid grid-cols-2 gap-3">
          {OBSERVATIONS.map((o) => {
            const on = logged[item!.entityId] === o.value;
            return (
              <button
                key={o.value}
                className="btn"
                style={{ minHeight: 64, fontSize: 18, ...(on ? { background: o.value === "upset" ? "var(--clay-text)" : "var(--sage-text)", color: "#fff", borderColor: "transparent" } : {}) }}
                aria-pressed={on}
                disabled={busy}
                onClick={() => tap(o.value)}
              >
                {o.text}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4">
        <label htmlFor="note">Note (optional, short)</label>
        <input id="note" style={{ minHeight: 56 }} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hummed along to the second verse" />
      </div>
      {err && <p role="alert" className="mt-3" style={{ color: "var(--clay-text)" }}>{err}</p>}
      {status}

      <div className="session-bar">
        <div className="wrap max-w-xl flex gap-3">
          <button className="btn" style={{ minHeight: 56, minWidth: 96 }} disabled={i === 0} onClick={() => go(i - 1)}>Back</button>
          <button className="btn btn-primary flex-1" style={{ minHeight: 56 }} onClick={() => go(i + 1)}>{i === card.items.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
