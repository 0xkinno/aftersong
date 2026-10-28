"use client";
import { motion, useReducedMotion } from "framer-motion";
import { FRIENDLY_TOOL, type TrailEvent } from "@/lib/types";

export default function BuildTrail({ events, running }: { events: TrailEvent[]; running: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="card p-5" aria-live="polite" aria-label="What the agent is doing">
      <p className="kicker mb-3">{running ? "The agent is working" : "What the agent did"}</p>
      <ol style={{ listStyle: "none", padding: 0 }} className="grid gap-3">
        {events.map((e, i) => (
          <motion.li key={`${e.at}${i}`} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="grid gap-0.5">
            <span className="mono text-12 text-ember-text uppercase tracking-widest">{FRIENDLY_TOOL[e.tool] ?? e.tool}</span>
            <span className="text-14">{e.summary}</span>
          </motion.li>
        ))}
        {running && events.length === 0 && <li className="text-14 text-ink-2">Starting</li>}
      </ol>
    </div>
  );
}
