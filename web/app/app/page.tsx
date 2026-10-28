"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/client";

interface Res { id: string; firstName: string; birthYear: number; hometown: string; favourites: Array<{ confirmed: boolean }> }

function Dashboard() {
  const [list, setList] = useState<Res[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", birthYear: "", careCity: "", hometown: "", f1: "", f2: "", f3: "", consent: false, consentBy: "family" });
  const [busy, setBusy] = useState(false);

  const load = () => api<{ residents: Res[] }>("/residents", { auth: true }).then((r) => setList(r.residents)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<Res>("/residents", { method: "POST", auth: true, body: { firstName: form.firstName, birthYear: Number(form.birthYear), careCity: form.careCity, hometown: form.hometown, favourites: [form.f1, form.f2, form.f3].filter(Boolean), consent: form.consent, consentBy: form.consentBy } });
      location.href = `/app/resident/${r.id}`;
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div className="wrap py-10">
      <p className="kicker">Carer</p>
      <h1 className="text-40 md:text-64">Your residents</h1>
      {err && <p role="alert" className="card p-4 mt-4" style={{ color: "var(--clay-text)" }}>{err}</p>}
      <div className="grid gap-8 mt-8 md:grid-cols-[1fr_420px]">
        <section aria-label="Residents">
          {list === null ? <p className="text-ink-2">Loading</p> : list.length === 0 ? <p className="card p-5 text-ink-2">No residents yet. Add the first one on the right, or send the family a link after you create them.</p> : (
            <ul className="grid gap-3" style={{ listStyle: "none", padding: 0 }}>
              {list.map((r) => (
                <li key={r.id}><Link href={`/app/resident/${r.id}`} className="card p-4 block no-underline"><span className="text-20 font-display">{r.firstName}</span><span className="block text-14 text-ink-2">Born {r.birthYear}, from {r.hometown}. {r.favourites.filter((f) => f.confirmed).length} of {r.favourites.length} favourites confirmed.</span></Link></li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex gap-3 flex-wrap"><Link className="btn" href="/app/group">Plan a group session</Link></div>
        </section>
        <form className="card p-5 grid gap-3" onSubmit={create} aria-label="New resident">
          <h2 className="text-28">New resident</h2>
          <div><label htmlFor="fn">First name</label><input id="fn" required maxLength={40} value={form.firstName} onChange={set("firstName")} /></div>
          <div><label htmlFor="by">Birth year</label><input id="by" required inputMode="numeric" pattern="[0-9]{4}" value={form.birthYear} onChange={set("birthYear")} /></div>
          <div><label htmlFor="cc">Home city (where they live now)</label><input id="cc" required maxLength={80} value={form.careCity} onChange={set("careCity")} /></div>
          <div><label htmlFor="ht">Where they grew up</label><input id="ht" required maxLength={80} value={form.hometown} onChange={set("hometown")} /></div>
          <div><label htmlFor="f1">Favourite one</label><input id="f1" required maxLength={80} value={form.f1} onChange={set("f1")} /></div>
          <div><label htmlFor="f2">Favourite two</label><input id="f2" maxLength={80} value={form.f2} onChange={set("f2")} /></div>
          <div><label htmlFor="f3">Favourite three</label><input id="f3" maxLength={80} value={form.f3} onChange={set("f3")} /></div>
          <div><label htmlFor="cb">Who agreed</label><select id="cb" value={form.consentBy} onChange={set("consentBy")}><option value="family">A member of the family</option><option value="resident">The resident</option></select></div>
          <label className="flex gap-3 items-start" style={{ color: "var(--ink)" }}><input type="checkbox" style={{ width: 24, minHeight: 24 }} checked={form.consent} onChange={set("consent")} required />The resident or their family agrees to this being used. No health details are entered.</label>
          <button className="btn btn-primary" disabled={busy}>Add resident</button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGate><Dashboard /></AuthGate>;
}
