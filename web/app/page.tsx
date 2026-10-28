import Link from "next/link";
import GlowCard from "@/components/GlowCard";
import HeroSvg from "@/components/HeroSvg";
import LandingCard from "@/components/LandingCard";
import FactsPanel from "@/components/FactsPanel";
import sources from "@/lib/sources.json";
import findings from "@/lib/findings.json";

// The discovery sentence is written by scripts/probe-matrix.mjs from measured results. Until a run exists, the plain claim below is shown, and it makes no number-based promise.
const DISCOVERY = (findings as { sentence: string | null }).sentence ?? "Everyone assumes music for old people is one playlist. The songs that reach a person come from the years they remember best and from what they loved.";

const STEPS = [
  { n: "01", t: "The family names three favourites", d: "Sam Cooke, Casablanca, his mother's jollof rice. They type it from anywhere through a private link." },
  { n: "02", t: "Aftersong finds the years", d: "People remember best what they lived between about ten and thirty. For a man born in 1940 that is 1950 to 1970." },
  { n: "03", t: "Qloo links taste inside those years", d: "Music, film, television, food and places, each tied to a favourite, each from his own window, not a generic oldies list." },
  { n: "04", t: "The carer taps what she saw", d: "Lit up, sang, no response, upset. Only her taps become memory, and the next card starts from what worked." },
];

export default function Home() {
  const stats = ["who", "turnover", "cochrane"].map((id) => sources.sources.find((s) => s.id === id)!);
  return (
    <>
      <section className="hero relative" aria-labelledby="hero">
        <div className="hero-bg" aria-hidden="true">
          {/* decorative, masked so the headline sits on clean paper */}
          <img src="/hero.webp" alt="" width={1800} height={1204} fetchPriority="low" decoding="async" />
        </div>
        <div className="wrap pt-16 pb-12 md:pt-24 grid gap-10 md:grid-cols-[1.25fr_1fr] items-center relative">
          <div>
            <p className="kicker">A reminiscence agent for memory care</p>
            <h1 id="hero" className="mt-4" style={{ fontSize: "clamp(48px, 9vw, 96px)", lineHeight: 1.02 }}>The songs he still knows.</h1>
            <p className="mt-6 text-20 max-w-xl text-ink-2">Marisol has twenty minutes before the afternoon session with a new resident who barely speaks. Aftersong turns three remembered favourites into a card of music, film, food and places from the years he remembers best.</p>
            <p className="mt-4 text-16 max-w-xl" data-testid="discovery">{DISCOVERY}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/sample">Try a sample resident</Link>
              <Link className="btn" href="/judge">For judges</Link>
            </div>
          </div>
          <div className="max-w-[520px] w-full justify-self-center md:justify-self-end"><HeroSvg className="w-full h-auto" /></div>
        </div>
      </section>

      <section className="wrap py-16" aria-labelledby="problem">
        <p className="kicker">01  The problem</p>
        <h2 id="problem" className="text-40 mt-2 max-w-2xl">Most care homes play one playlist for everyone.</h2>
        <div className="grid gap-4 mt-8 md:grid-cols-3">
          {stats.map((s) => (
            <GlowCard key={s.id} className="p-6">
              <p className="font-display text-64" style={{ fontSize: 48, lineHeight: 1 }}>{s.stat}</p>
              <p className="mt-3 text-16">{s.statement}</p>
              <a className="text-14 underline mt-3 inline-block" href={s.url}>{s.label}</a>
            </GlowCard>
          ))}
        </div>
      </section>

      <section className="wrap py-16" aria-labelledby="how">
        <p className="kicker">02  How it works</p>
        <h2 id="how" className="text-40 mt-2">Four steps, one carer in the room.</h2>
        <ol className="grid gap-5 mt-8 md:grid-cols-2 lg:grid-cols-4" style={{ listStyle: "none", padding: 0 }}>
          {STEPS.map((s) => (
            <li key={s.n} className="paper-tilt">
              <GlowCard className="p-6 h-full">
                <p className="kicker">{s.n}</p>
                <h3 className="text-28 mt-2">{s.t}</h3>
                <p className="mt-3 text-ink-2">{s.d}</p>
              </GlowCard>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap py-16" aria-labelledby="card">
        <p className="kicker">03  The card</p>
        <h2 id="card" className="text-40 mt-2 mb-8">What Marisol walks in with.</h2>
        <LandingCard />
      </section>

      <section className="wrap py-16" aria-labelledby="compare">
        <p className="kicker">04  A plain AI, side by side</p>
        <h2 id="compare" className="text-40 mt-2 max-w-2xl">Same intake, same rules, two different lists.</h2>
        <p className="mt-3 max-w-2xl text-ink-2">A plain model is asked for items for the same resident. Every item is looked up in Qloo and checked: is it a real entity, is it inside his years, does Qloo link it to what he loved.</p>
        <div className="mt-6"><FactsPanel /></div>
        <Link className="btn mt-6" href="/compare">See one comparison</Link>
      </section>

      <section className="wrap py-16" aria-labelledby="not">
        <p className="kicker">05  What it will not do</p>
        <h2 id="not" className="text-40 mt-2">Limits that are built in, not promised.</h2>
        <ul className="grid gap-3 mt-6 md:grid-cols-2" style={{ listStyle: "none", padding: 0 }}>
          {[
            "It does not diagnose, and no line on a card claims a health effect.",
            "It does not add anything the model merely thinks he would like. Every item is a Qloo result inside his years.",
            "It does not send names or health details to Qloo. Qloo receives entity IDs, tags, years and a place.",
            "It does not guess when Qloo has too little. The card says so and offers to widen the window.",
            "It does not remember what the carer did not see. Only her taps are memory, and they expire after 90 days unless repeated.",
            "It does not repeat something that upset him.",
          ].map((t) => (
            <li key={t} className="card p-4">{t}</li>
          ))}
        </ul>
      </section>

      <section className="wrap py-16" aria-labelledby="homes">
        <p className="kicker">06  For care homes</p>
        <h2 id="homes" className="text-40 mt-2">Who it is for and what it might cost.</h2>
        <p className="mt-3 max-w-2xl text-ink-2">The user is the activities coordinator. The buyer is the director of care at a memory care operator or a home care agency. The pricing below is a hypothesis to test, not a result: about four dollars per resident per month, and free for a family with one resident. No customer has paid yet.</p>
      </section>
    </>
  );
}
