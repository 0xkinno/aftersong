"use client";
import { motion, useReducedMotion } from "framer-motion";
import GlowCard from "./GlowCard";
import { playUrl } from "@/lib/play";
import { DOMAIN_LABEL, FRIENDLY_TOOL, LABEL_TEXT, OBSERVATIONS, type SessionCard } from "@/lib/types";

const REASON: Record<string, string> = {
  not_qloo_entity: "Not an entity Qloo returned in this build",
  is_seed: "It is one of the confirmed favourites",
  duplicate: "Already on the card",
  era_unknown: "Qloo gave no year for it",
  outside_window: "Outside the years that matter",
  not_connected: "Not scored against a confirmed favourite",
  suppressed_upset: "Marked upset earlier, so it stays off",
  wrong_domain: "Wrong kind of item",
};
const TAG_CLASS = { personal: "tag tag-personal", shared_era: "tag tag-shared", widely_known: "tag tag-known", overlap: "tag tag-known", hometown: "tag tag-shared" } as const;

export default function CardView({ card, sample = false, residentName, onWiden, actions }: { card: SessionCard; sample?: boolean; residentName?: string; onWiden?: () => void; actions?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const thin = card.status === "thin";
  return (
    <section aria-label="Session card" className="card-print">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="kicker">{sample ? "Sample  " : ""}Session card</p>
          <h2 className="text-28 md:text-40">{residentName ? `For ${residentName}` : "Reminiscence session"}</h2>
          <p className="text-ink-2 mono text-14 mt-1">
            {card.window.start} to {card.window.end}
            {card.widenedBy ? `  (widened by ${card.widenedBy})` : ""}  {card.items.length} items
          </p>
        </div>
        <div className="no-print flex gap-3 flex-wrap">
          {actions}
          <button className="btn" onClick={() => window.print()}>Print card</button>
        </div>
      </div>

      {card.model === null && (
        <p role="status" className="card p-4 mb-4 text-14">
          The model was not used for this card, so every opener is a labelled template line. {card.trail.find((t) => t.tool === "agent")?.summary}
        </p>
      )}

      {thin && (
        <div role="status" className="card p-5 mb-6">
          <h3 className="text-28">Not enough from these years yet</h3>
          <p className="text-ink-2 mt-1">Qloo returned too few items inside this window. Nothing was added from a guess.</p>
          {onWiden && card.abstentions.some((a) => a.canWiden) && (
            <button className="btn btn-primary mt-4 no-print" onClick={onWiden}>Widen the window by 5 years</button>
          )}
        </div>
      )}

      <ol className="grid gap-4 md:grid-cols-2" style={{ listStyle: "none", padding: 0 }}>
        {card.items.map((it, i) => (
          <motion.li key={it.entityId} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : i * 0.08, duration: 0.35 }}>
            <GlowCard className="p-5 h-full">
              <div className="flex items-center justify-between gap-2">
                <span className="kicker">{DOMAIN_LABEL[it.domain]}{it.year ? `  ${it.year}` : ""}</span>
                <span className={TAG_CLASS[it.label]}>{LABEL_TEXT[it.label]}</span>
              </div>
              <h3 className="text-28 mt-2">{it.name}</h3>
              <p className="text-16 mt-2"><strong>Because of:</strong> {it.connectionBasis === "explainability" || (it.connectedAll ?? []).length < 2 ? it.connectedTo.name : (it.connectedAll ?? []).map((c) => c.name).join(", ")}</p>
              <p className="text-14 text-ink-2 mt-1 print-hide">
                {it.connectionBasis === "explainability" || (it.connectedAll ?? []).length < 2 ? (
                  <>Qloo links this to <strong className="text-ink">{it.connectedTo.name}</strong> for people with similar taste.</>
                ) : (
                  <>Qloo scored this against {(it.connectedAll ?? []).map((c) => c.name).join(", ")} together, for people with similar taste.</>
                )}
                {it.connectedTo.kind === "observation" ? " The carer saw a good reaction to that earlier." : ""}
              </p>
              {it.walk && (
                <p className="text-14 mt-1">
                  <span className="kicker">Walk</span> {it.walk.fromName}, marked {OBSERVATIONS.find((o) => o.value === it.walk!.fromObservation)?.text.toLowerCase()}, led here.
                </p>
              )}
              <p className="mt-3 text-20 font-display">&ldquo;{it.opener.text}&rdquo;</p>
              {it.opener.source === "template" && <p className="text-12 mono text-ink-2 mt-1 print-hide">Template line{it.opener.blocked ? `, the model line was blocked (${it.opener.blocked.length})` : ""}</p>}
              {it.label === "personal" && it.cohortUnknown && <p className="text-12 mono text-ink-2 mt-1 print-hide">Age cohort score unknown</p>}
              <p className="mt-3 no-print"><a className="underline text-14 inline-flex items-center" style={{ minHeight: 44 }} href={playUrl(it).href} target="_blank" rel="noopener noreferrer">{playUrl(it).label}</a></p>
              {it.tags.length > 0 && <p className="text-12 mono text-ink-2 mt-2">{it.tags.slice(0, 4).map((t) => t.name).join("  ")}</p>}
            </GlowCard>
          </motion.li>
        ))}
      </ol>

      {card.abstentions.filter((a) => a.domain !== "card").length > 0 && (
        <p className="mt-4 text-14 text-ink-2">
          Nothing placed for: {card.abstentions.filter((a) => a.domain !== "card").map((a) => (DOMAIN_LABEL as Record<string, string>)[a.domain] ?? a.domain).join(", ")}. Not enough from these years yet.
        </p>
      )}

      <details className="mt-8 no-print" data-testid="how-made">
        <summary className="cursor-pointer kicker" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>How this card was made ({(card.decisions ?? []).length} decisions)</summary>
        <div className="mt-3 grid gap-3">
          {(card.decisions ?? []).length === 0 ? <p className="text-14 text-ink-2">The agent made no decisions beyond the fixed steps below.</p> : (
            <ol className="grid gap-2" style={{ listStyle: "none", padding: 0 }}>
              {(card.decisions ?? []).map((d, i) => (
                <li key={i} className="card p-3 text-14"><span className="kicker">{d.decision.replace(/_/g, " ")}</span><br />{d.why}{d.count !== null ? ` (${d.count})` : ""}{d.call ? ` call ${d.call}` : ""}</li>
              ))}
            </ol>
          )}
          <ol className="grid gap-1" style={{ listStyle: "none", padding: 0 }}>
            {card.trail.map((e, i) => <li key={i} className="text-14"><span className="mono text-12 uppercase tracking-widest text-ember-text">{FRIENDLY_TOOL[e.tool] ?? e.tool}</span> {e.summary}</li>)}
          </ol>
        </div>
      </details>

      <details className="mt-4 no-print">
        <summary className="cursor-pointer kicker">What the rules turned away ({card.rejections.length})</summary>
        <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto mt-3">
          <table>
            <thead><tr><th>Item</th><th>Kind</th><th>Reason</th></tr></thead>
            <tbody>
              {card.rejections.slice(0, 60).map((r) => (
                <tr key={`${r.entityId}${r.failures[0]?.rule}`}>
                  <td>{r.name}</td>
                  <td>{DOMAIN_LABEL[r.domain]}</td>
                  <td>{r.failures.map((f) => (f.rule === "outside_window" && f.detail ? f.detail : (REASON[f.rule] ?? f.rule))).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-6 text-12 text-ink-2 mono">
        {card.calls.filter((c) => !c.cached).length} live Qloo calls, {card.calls.filter((c) => c.cached).length} from cache. Qloo results are aggregate taste affinities, not a promise about one person.
      </p>
    </section>
  );
}
