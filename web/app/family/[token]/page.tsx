"use client";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/client";

interface View {
  resident: { firstName: string; birthYear: number; hometown: string; favourites: Array<{ text: string; confirmed: boolean; name: string | null }>; window: { start: number; end: number } };
  memory: Array<{ id: string; name: string; domain: string; value: string; at: string; note: string | null }>;
  works: string[];
  avoid: string[];
  digests: Array<{ id: string; week: string; lines: string[] }>;
}

export default function Family({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ birthYear: "", hometown: "", f: ["", "", ""] });
  const [saved, setSaved] = useState(false);

  const load = () => api<View>(`/family/${token}`).then((d) => { setV(d); setForm({ birthYear: String(d.resident.birthYear), hometown: d.resident.hometown, f: [0, 1, 2].map((i) => d.resident.favourites[i]?.text ?? "") }); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [token]);

  if (err) return <div className="wrap py-16 max-w-xl"><h1 className="text-40">This link is not valid</h1><p className="mt-3 text-ink-2">{err}</p></div>;
  if (!v) return <p className="wrap py-16 text-ink-2">Loading</p>;

  return (
    <div className="wrap py-10 max-w-3xl">
      <p className="kicker">Family</p>
      <h1 className="text-40 md:text-64">{v.resident.firstName}</h1>
      <p className="text-ink-2">You hold the memories. The carer holds what she sees in the room. You can change what you told us, read the weekly note, and delete anything the carer logged.</p>

      <form className="card p-5 mt-8 grid gap-3" onSubmit={async (e) => {
        e.preventDefault(); setErr(null); setSaved(false);
        try { await api(`/family/${token}/intake`, { method: "PUT", body: { birthYear: Number(form.birthYear), hometown: form.hometown, favourites: form.f.filter(Boolean) } }); setSaved(true); load(); } catch (x) { setErr((x as Error).message); }
      }}>
        <h2 className="text-28">What you told us</h2>
        <div><label htmlFor="by">Birth year</label><input id="by" inputMode="numeric" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} /></div>
        <div><label htmlFor="ht">Where they grew up</label><input id="ht" value={form.hometown} onChange={(e) => setForm({ ...form, hometown: e.target.value })} /></div>
        {form.f.map((x, i) => <div key={i}><label htmlFor={`f${i}`}>Favourite {i + 1}</label><input id={`f${i}`} maxLength={80} value={x} onChange={(e) => { const f = [...form.f]; f[i] = e.target.value; setForm({ ...form, f }); }} /></div>)}
        <p className="text-14 text-ink-2">Best remembered years: {v.resident.window.start} to {v.resident.window.end}. {v.resident.favourites.filter((f) => f.confirmed).length} of {v.resident.favourites.length} favourites confirmed by the carer.</p>
        <button className="btn btn-primary">Save</button>
        {saved && <p role="status">Saved.</p>}
      </form>

      <section className="mt-10" aria-label="Weekly notes">
        <h2 className="text-28">Weekly notes</h2>
        {v.digests.length === 0 ? <p className="mt-2 text-ink-2">No weekly note yet. One is written on Monday when the carer has logged reactions.</p> : v.digests.map((d) => <div key={d.id} className="card p-4 mt-3"><p className="kicker">{d.week}</p>{d.lines.map((l) => <p key={l}>{l}</p>)}</div>)}
      </section>

      <section className="mt-10" aria-label="What was logged">
        <h2 className="text-28">What the carer logged</h2>
        <p className="mt-2 text-ink-2">What worked: {v.works.length ? v.works.join(", ") : "nothing yet"}. Stays off: {v.avoid.length ? v.avoid.join(", ") : "nothing"}.</p>
        <ul className="grid gap-2 mt-4" style={{ listStyle: "none", padding: 0 }}>
          {v.memory.map((m) => (
            <li key={m.id} className="card p-3 flex justify-between gap-3 items-center">
              <span><strong>{m.name}</strong>, {m.value.replace(/_/g, " ")}{m.note ? `. ${m.note}` : ""} <span className="text-12 mono text-ink-2">{m.at.slice(0, 10)}</span></span>
              <button className="btn" style={{ minHeight: 40 }} onClick={async () => { await api(`/family/${token}/memory/${m.id}`, { method: "DELETE" }); load(); }}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
      <a className="btn mt-8" href={`/api/family/${token}/lifestory`} target="_blank" rel="noreferrer">Open the one page about me</a>
    </div>
  );
}
