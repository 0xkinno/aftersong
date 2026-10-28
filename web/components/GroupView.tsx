"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Res { id: string; firstName: string; birthYear: number }
interface Plan {
  plan: {
    items: Array<{ candidate: { id: string; name: string; domain: string; year: number | null }; minScore: number; coverage: number; perResident: Record<string, number | null | "n/a" | "veto"> }>;
    excluded: Array<{ id: string; name: string; reason: string }>;
    coverage: Array<{ residentId: string; firstName: string; covered: number; leftOut: boolean }>;
  };
  calls: number;
}

export default function GroupView({ mode }: { mode: "sample" | "carer" }) {
  const [list, setList] = useState<Res[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = mode === "sample" ? api<{ residents: Res[] }>("/sample/residents") : api<{ residents: Res[] }>("/residents", { auth: true });
    p.then((r) => {
      setList(r.residents);
      setPick(r.residents.slice(0, 4).map((x) => x.id));
    }).catch((e) => setErr(e.message));
  }, [mode]);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setPlan(await api<Plan>(mode === "sample" ? "/sample/group" : "/group", { method: "POST", body: { residentIds: pick }, auth: mode === "carer" }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const first = (id: string) => list.find((r) => r.id === id)?.firstName ?? id;

  return (
    <div>
      <fieldset className="card p-5">
        <legend className="kicker px-2">Who is in the room (2 to 8)</legend>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {list.map((r) => (
            <label key={r.id} className="flex items-center gap-3 text-16" style={{ color: "var(--ink)" }}>
              <input type="checkbox" style={{ width: 24, minHeight: 24 }} checked={pick.includes(r.id)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
              {r.firstName}, born {r.birthYear}
            </label>
          ))}
        </div>
        <button className="btn btn-primary mt-4" disabled={busy || pick.length < 2 || pick.length > 8} onClick={run}>{busy ? "Re-scoring one pool for each resident" : "Plan the session"}</button>
        <p className="text-12 text-ink-2 mt-2">Live and limited per visitor. Many Qloo calls, so it takes a few seconds.</p>
      </fieldset>
      {err && <p role="alert" className="card p-4 mt-4" style={{ color: "var(--clay-text)" }}>{err}</p>}
      {plan && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section>
            <p className="kicker">Items chosen for the room</p>
            <ul className="grid gap-3 mt-3" style={{ listStyle: "none", padding: 0 }}>
              {plan.plan.items.map((i) => (
                <li key={i.candidate.id} className="card p-4">
                  <div className="flex justify-between"><span className="kicker">{i.candidate.domain}{i.candidate.year ? `  ${i.candidate.year}` : ""}</span><span className="mono text-12">weakest fit {Math.round(i.minScore * 100)}</span></div>
                  <p className="text-20 font-display mt-1">{i.candidate.name}</p>
                  <p className="text-12 mono text-ink-2 mt-2">{Object.entries(i.perResident).map(([id, v]) => `${first(id)} ${v === "n/a" ? "not in their years" : v === "veto" ? "vetoed" : v === null ? "unknown" : Math.round((v as number) * 100)}`).join("  ")}</p>
                </li>
              ))}
              {plan.plan.items.length === 0 && <li className="card p-4 text-ink-2">Not enough overlap from these residents' years yet.</li>}
            </ul>
          </section>
          <aside>
            <p className="kicker">Who the session leaves out</p>
            <table className="mt-3">
              <thead><tr><th>Resident</th><th>Well served</th></tr></thead>
              <tbody>
                {plan.plan.coverage.map((c) => (
                  <tr key={c.residentId}><td>{c.firstName}</td><td>{c.covered} of {plan.plan.items.length}{c.leftOut ? "  left out" : ""}</td></tr>
                ))}
              </tbody>
            </table>
            {plan.plan.excluded.length > 0 && <p className="text-12 text-ink-2 mt-3">{plan.plan.excluded.length} items were dropped: unscored for enough residents, or vetoed because one resident was upset by them.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
