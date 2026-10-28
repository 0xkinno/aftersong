"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BuildTrail from "@/components/BuildTrail";
import CardView from "@/components/CardView";
import { api, streamCard } from "@/lib/client";
import { getToken } from "@/lib/supabase";
import type { SessionCard, TrailEvent } from "@/lib/types";

interface Match { id: string; name: string; type: string | null; note: string | null; kind: "entity" | "tag" }
interface Item { text: string; confirmed: boolean; resolution: { status: string; matches: Match[] } | null }
interface Timeline { resident: { id: string; firstName: string; birthYear: number; hometown: string; familySubmittedAt: string | null }; cards: SessionCard[]; works: Array<{ entityName: string; value: string }>; avoid: Array<{ entityName: string }>; expired: Array<{ entityName: string }> }

function Resident({ id }: { id: string }) {
  const [tl, setTl] = useState<Timeline | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [card, setCard] = useState<SessionCard | null>(null);
  const [trail, setTrail] = useState<TrailEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [needs, setNeeds] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api<Timeline>(`/residents/${id}/timeline`, { auth: true });
      setTl(t);
      setCard((c) => c ?? t.cards[0] ?? null);
    } catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const resolve = async () => {
    setErr(null);
    try { setItems((await api<{ items: Item[] }>(`/residents/${id}/resolve`, { method: "POST", auth: true, body: {} })).items); } catch (e) { setErr((e as Error).message); }
  };
  const confirm = async (text: string, pick: Match | null) => {
    await api(`/residents/${id}/confirm`, { method: "POST", auth: true, body: { text, pick } });
    await resolve();
    setNeeds(false);
  };
  const build = async (widenBy = 0) => {
    setRunning(true); setErr(null); setTrail([]); setNeeds(false);
    try {
      const r = await streamCard(`/residents/${id}/cards`, { widenBy }, true, { onTrail: (e) => setTrail((t) => [...t, e]) });
      setCard(r.card);
      load();
    } catch (e) {
      const ae = e as { code?: string; message: string };
      if (ae.code === "NEEDS_CONFIRMATION") { setNeeds(true); resolve(); } else setErr(ae.message);
    } finally { setRunning(false); }
  };
  const pdf = async () => {
    const t = await getToken();
    const res = await fetch(`/api/residents/${id}/lifestory`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) return setErr("The life story could not be made.");
    window.open(URL.createObjectURL(await res.blob()), "_blank");
  };
  const makeLink = async () => {
    const r = await api<{ token: string }>(`/residents/${id}/family-link`, { method: "POST", auth: true, body: {} });
    setLink(`${location.origin}/family/${r.token}`);
  };

  if (!tl) return <div className="wrap py-16">{err ? <p role="alert" style={{ color: "var(--clay-text)" }}>{err}</p> : <p className="text-ink-2">Loading</p>}</div>;
  const r = tl.resident;
  const widen = card ? card.widenedBy + 5 : 5;

  return (
    <div className="wrap py-10">
      <Link href="/app" className="text-14 underline">All residents</Link>
      <p className="kicker mt-4">Resident</p>
      <h1 className="text-40 md:text-64">{r.firstName}</h1>
      <p className="text-ink-2">Born {r.birthYear}, grew up in {r.hometown}.{r.familySubmittedAt ? " Intake filled in by the family." : ""}</p>
      {err && <p role="alert" className="card p-4 mt-4" style={{ color: "var(--clay-text)" }}>{err}</p>}

      <div className="grid gap-8 mt-8 lg:grid-cols-[360px_1fr]">
        <aside className="grid gap-4 content-start">
          <div className="card p-5">
            <p className="kicker">Favourites</p>
            <button className="btn mt-3" onClick={resolve}>Check matches in Qloo</button>
            {needs && <p role="status" className="mt-3 text-14">Confirm at least one favourite below before a card can be built.</p>}
            {items?.map((it) => (
              <fieldset key={it.text} className="mt-4">
                <legend className="text-16 font-display">{it.text}</legend>
                {it.confirmed ? <p className="text-14 text-ink-2">Confirmed.</p> : it.resolution?.matches.length ? (
                  <div className="grid gap-2 mt-2">
                    {it.resolution.matches.map((m) => (
                      <button key={m.id} className="btn text-left" style={{ justifyContent: "flex-start", minHeight: 48 }} onClick={() => confirm(it.text, m)}>{m.name}{m.type ? `  (${m.type.split(":").pop()})` : ""}{m.kind === "tag" ? "  (tag)" : ""}</button>
                    ))}
                    <button className="text-14 underline text-left" onClick={() => confirm(it.text, null)}>None of these is right</button>
                  </div>
                ) : <p className="text-14" style={{ color: "var(--clay-text)" }}>Qloo has nothing for this. It will not be used.</p>}
              </fieldset>
            ))}
          </div>
          <div className="card p-5">
            <p className="kicker">Family and memory</p>
            <p className="text-14 mt-2">What worked: {tl.works.length ? tl.works.map((w) => w.entityName).join(", ") : "nothing logged yet"}.</p>
            <p className="text-14 mt-1">Stays off: {tl.avoid.length ? tl.avoid.map((w) => w.entityName).join(", ") : "nothing"}.</p>
            {tl.expired.length > 0 && <p className="text-14 mt-1 text-ink-2">{tl.expired.length} older reactions have expired after 90 days.</p>}
            <div className="grid gap-2 mt-4">
              <button className="btn" onClick={makeLink}>Create a private family link</button>
              {link && <p className="text-12 mono break-all" role="status">{link}</p>}
              <button className="btn" onClick={pdf}>Open the one page about me</button>
            </div>
          </div>
        </aside>

        <section>
          <div className="flex gap-3 flex-wrap items-center">
            <button className="btn btn-primary" disabled={running} onClick={() => build(0)}>{running ? "Building" : card ? "Build a new card" : "Build the first card"}</button>
            {card && <Link className="btn" href={`/session/${card.id}`}>Start session</Link>}
          </div>
          {(running || trail.length > 0) && <div className="mt-6"><BuildTrail events={trail} running={running} /></div>}
          {card && <div className="mt-8"><CardView card={card} residentName={r.firstName} onWiden={() => build(widen)} /></div>}
          {tl.cards.length > 1 && (
            <div className="mt-10">
              <p className="kicker">Earlier cards</p>
              <ul className="grid gap-2 mt-3" style={{ listStyle: "none", padding: 0 }}>
                {tl.cards.slice(1).map((c) => <li key={c.id}><button className="underline text-left" onClick={() => setCard(c)}>{c.createdAt.slice(0, 16).replace("T", " ")}, {c.items.length} items</button></li>)}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AuthGate><Resident id={id} /></AuthGate>;
}
