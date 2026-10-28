import { FRIENDLY_TOOL } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trace, Aftersong" };

interface Trace { at: string; cards: Array<{ id: string; createdAt: string; status: string; items: number; rejected: number; model: { provider: string; id: string } | null; trail: Array<{ at: string; tool: string; summary: string }>; calls: Array<{ id: string; path: string; cached: boolean; status: number | null; ms: number; resultCount: number | null }> }> }

async function load(): Promise<Trace | null> {
  const base = process.env.BACKEND_URL;
  if (!base) return null;
  try {
    const res = await fetch(new URL("/trace", base), { headers: { "x-shared-secret": process.env.BACKEND_SHARED_SECRET ?? "" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
    return res.ok ? ((await res.json()) as Trace) : null;
  } catch {
    return null;
  }
}

export default async function TracePage() {
  const t = await load();
  return (
    <div className="wrap py-10">
      <p className="kicker">Trace  Sample cards</p>
      <h1 className="text-40 md:text-64">The running system's own account</h1>
      <p className="mt-3 max-w-2xl text-ink-2">The last sample cards the agent built: each tool call it made, and each Qloo request with its status and time. Nothing is edited. Live probes are on <a className="underline" href="/api/status">/api/status</a>.</p>
      {!t && <p role="status" className="card p-5 mt-8">The backend did not answer, so there is no trace to show.</p>}
      {t && t.cards.length === 0 && <p className="card p-5 mt-8">No sample card has been built yet.</p>}
      {t?.cards.map((c) => (
        <section key={c.id} className="card p-5 mt-6" aria-label={`Card ${c.id}`}>
          <p className="kicker">{c.createdAt}  {c.status}  {c.items} items  {c.rejected} rejected  {c.model ? `${c.model.provider}/${c.model.id}` : "no model"}</p>
          <ol className="mt-3 grid gap-2" style={{ listStyle: "none", padding: 0 }}>
            {c.trail.map((e, i) => <li key={i}><span className="mono text-12 uppercase tracking-widest text-ember-text">{FRIENDLY_TOOL[e.tool] ?? e.tool}</span> <span className="text-14">{e.summary}</span></li>)}
          </ol>
          <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto mt-4">
            <table><thead><tr><th>Call</th><th>Path</th><th>Status</th><th>Cached</th><th>Results</th><th>Milliseconds</th></tr></thead>
              <tbody>{c.calls.map((x) => <tr key={x.id}><td className="mono text-12">{x.id}</td><td className="mono text-12">{x.path}</td><td>{x.status ?? "none"}</td><td>{x.cached ? "yes" : "no"}</td><td>{x.resultCount ?? "none"}</td><td>{x.ms}</td></tr>)}</tbody></table>
          </div>
        </section>
      ))}
    </div>
  );
}
