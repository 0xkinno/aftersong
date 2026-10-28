import Link from "next/link";
import HardCase from "@/components/HardCase";
import GlowCard from "@/components/GlowCard";
import sabotage from "@/lib/sabotage-result.json";

export const metadata = { title: "For judges, Aftersong" };

const WALK = [
  { t: "Open the sample", d: "A resident, born 1940, with three favourites. No sign-in.", href: "/sample", cta: "Open /sample" },
  { t: "Watch the agent place the card", d: "Each tool call appears as it happens. Every item shows the year, the favourite it connects to, and a Personal, Shared era or Widely known tag.", href: "/sample", cta: "Build it live" },
  { t: "Open what the rules turned away", d: "Candidates outside the years, without a year, or not linked to a favourite are listed with the reason.", href: "/sample", cta: "See rejections" },
  { t: "Run the session on a phone", d: "One item per screen, six big taps for what the carer sees.", href: "/sample/sample-walter/session", cta: "Open session mode" },
  { t: "Compare with a plain AI list", d: "The same model without Qloo, checked by the same rules.", href: "/compare", cta: "Compare" },
  { t: "Plan a room", d: "Four residents, one pool, the item that works for the person it fits least.", href: "/group", cta: "Group session" },
  { t: "Break it on purpose", d: "The hard case below, and the fault switch result.", href: "#break", cta: "Jump to it" },
];

export default function Judge() {
  return (
    <div className="wrap py-10">
      <p className="kicker">For judges</p>
      <h1 className="text-40 md:text-64">Sixty seconds, no sign-in</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Everything on this page works without an account. Sample residents are labelled Sample. Live builds are limited per visitor and per day; the saved sample always works.</p>

      <ol className="grid gap-3 mt-8" style={{ listStyle: "none", padding: 0 }}>
        {WALK.map((w, i) => (
          <li key={w.t}>
            <GlowCard className="p-5 grid gap-2 md:grid-cols-[48px_1fr_auto] items-center">
              <span className="font-display text-28">{i + 1}</span>
              <div><h2 className="text-20">{w.t}</h2><p className="text-ink-2 text-14">{w.d}</p></div>
              <Link className="btn" href={w.href}>{w.cta}</Link>
            </GlowCard>
          </li>
        ))}
      </ol>

      <section id="break" className="mt-12 grid gap-6 md:grid-cols-2" aria-label="Break it on purpose">
        <HardCase />
        <div className="card p-5">
          <p className="kicker">Fault switch</p>
          <p className="mt-2">With <code className="mono">AFTERSONG_SABOTAGE=model_injects</code> the model tries to swap a card line for a name that is not on the card and to add an item that does not exist.</p>
          <p className="mt-3" role="status">Result of the last run: {sabotage.blockedLines} line blocked and replaced with a template line, {sabotage.blockedEntities} extra item refused, card checks {sabotage.verifierOk ? "all pass" : "fail"}. Run {sabotage.ranAt.slice(0, 10)} on a synthetic Qloo stand-in, offline, so it spends nothing.</p>
          <p className="mt-3 text-14 text-ink-2">Reproduce: <code className="mono">npm run sabotage</code></p>
        </div>
      </section>

      <section className="mt-12 grid gap-3 md:grid-cols-2" aria-label="Go deeper">
        <div className="card p-5">
          <p className="kicker">Three minutes</p>
          <ul className="mt-2 grid gap-1"><li><Link className="underline" href="/method">Every rule and every Qloo call</Link></li><li><Link className="underline" href="/evidence">Measured results and misses</Link></li><li><Link className="underline" href="/trace">What the running system reports about itself</Link></li><li><a className="underline" href="/api/status">Live status, measured by real probes</a></li></ul>
        </div>
        <div className="card p-5">
          <p className="kicker">Ten minutes, from a clean clone</p>
          <pre className="mono text-12 mt-2 overflow-x-auto" tabIndex={0}>{`git clone https://github.com/0xkinno/aftersong
cd aftersong
npm --prefix backend ci
npm test
npm run verify:fixtures
npm run check`}</pre>
          <p className="text-14 text-ink-2 mt-2">No keys needed. To check a live card, download its export from the sample page and run <code className="mono">npm run verify -- card.json</code>.</p>
        </div>
      </section>
    </div>
  );
}
