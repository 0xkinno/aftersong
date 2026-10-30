export const metadata = { title: "Method, Aftersong" };

const RULES = [
  ["The window", "A resident's window is the years they were 10 to 30 years old. The carer can move it between 5 and 35. It is a hard filter: anything outside is rejected in code, with the reason shown.", "backend/src/core/window.ts"],
  ["Real entities only", "Every item must be an entity Qloo returned in this build. A name the model makes up cannot become an item.", "backend/src/core/rules.ts"],
  ["Tied to a favourite", "Every item must be scored by Qloo against a favourite the carer confirmed, or against something the carer saw work.", "backend/src/core/rules.ts"],
  ["Nothing that upset", "An item marked upset is removed for that resident for good, and items that share two or more tags with it count for less.", "backend/src/core/memory.ts"],
  ["Openers name nothing else", "The model writes one line per item. A line that names a person or title Qloo returned elsewhere, a multi word name not on the card, a listed health claim, or breaks house style is replaced by a template line, and the card says so.", "backend/src/core/openers.ts"],
  ["Qloo sees only IDs", "Requests to Qloo may carry entity IDs, tag IDs, an age bracket, years, and a place as an ID or a point. Names and health details cannot leave.", "backend/src/qloo/guard.ts"],
  ["Not enough is an answer", "When fewer than six items survive, the card says so and offers a five year widening. It never pads.", "backend/src/core/card.ts"],
  ["Why upset never expires", "Every other reaction fades after 90 days unless it is logged again. An upset reaction does not fade, because a painful association should not lapse with the calendar. Only the family or the carer can delete it.", "backend/src/core/memory.ts"],
  ["Compare ranks, not raw scores", "A score is only comparable between two calls that share a signal. So his favourites and the 55 and older audience are ranked over the same pinned pool, and the labels come from those ranks: Personal is top third for him and bottom half for the 55 and older audience.", "backend/src/qloo/find.ts, backend/src/core/classify.ts"],
  ["No score, no item", "Affinity is read only from query.affinity. If Qloo returns none for an item, the item is skipped. Popularity is never used in its place.", "backend/src/qloo/entity.ts, backend/src/core/rules.ts"],
  ["Signals go where they work", "Music and film favourites drive music, film and television. Food favourites drive only food and places. Location is used only on open place queries, never on a pinned pool and never to localise films.", "backend/src/core/route.ts, backend/src/qloo/guard.ts"],
  ["Memory is the carer's taps", "Six reactions, stored with who, when, card and item. Positives become new signals. Entries expire after 90 days unless logged again. The family can view and delete them.", "backend/src/core/memory.ts"],
];

// Index into RULES, grouped by what the rule protects.
const GROUPS: Array<[string, string, number[]]> = [
  ["Era and truth", "What can appear on a card at all.", [0, 1, 2, 9, 6]],
  ["Ranking", "How items are ordered and labelled.", [8, 10]],
  ["Memory and care", "What the carer's taps change.", [3, 7, 11]],
  ["Words and privacy", "What the model may write and what Qloo may see.", [4, 5]],
];

const CALLS = [
  ["Resolve favourites", "/search", "The typed name, optionally an entity type", "Entity IDs the carer confirms"],
  ["Tags", "/v2/tags", "A short phrase, semantic search on", "Tag IDs for cuisines and genres"],
  ["Hometown and home city", "/search with a locality type", "The place name", "A locality ID, sent onward as an ID"],
  ["Music, film, television", "/v2/insights", "filter.type, signal.interests.entities, filter.release_year (film, TV), feature.explainability", "Ranked entities with affinity, popularity and tags"],
  ["The 55 and older audience", "/v2/insights", "The same filters with signal.demographics.age=55_and_older and no favourites", "The cohort's ranking of the same kind of item"],
  ["Same pool, both scores", "/v2/insights with filter.results.entities", "The items missing from one list", "A score for every item under both signals"],
  ["Food near him, places from home", "/v2/insights", "filter.tags (cuisine), signal.location (a locality ID)", "Places and destinations tied to home"],
  ["Not repeating", "/v2/insights with filter.exclude.entities", "IDs the carer marked upset", "Results without them"],
];

const order = GROUPS.flatMap((g) => g[2]);
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function Method() {
  return (
    <div className="wrap py-10">
      <p className="kicker">Method</p>
      <h1 className="text-40 md:text-64">Every rule and every call</h1>
      <p className="mt-3 max-w-2xl text-ink-2">The agent chooses which tools to call and in what order. It does not choose what goes on the card. Rules in code do, after Qloo answers, even when the same limit was sent as a filter.</p>

      <dl className="statrow mt-8">
        <div><dt>Rules in code</dt><dd>{RULES.length}</dd></div>
        <div><dt>Qloo calls</dt><dd>{CALLS.length}</dd></div>
        <div><dt>Gap between calls</dt><dd>250 ms</dd></div>
        <div><dt>Answers cached</dt><dd>1 day</dd></div>
      </dl>

      <h2 className="text-28 mt-12">The rules</h2>
      <div className="grid gap-6 mt-5 md:grid-cols-2 items-start">
        {GROUPS.map(([name, blurb, ids]) => (
          <section key={name} className="panel">
            <header className="panel-head"><h3>{name}</h3><p>{blurb}</p></header>
            <ol className="rulelist">
              {ids.map((i) => (
                <li key={RULES[i][0]}>
                  <span className="rule-n">{num(order.indexOf(i))}</span>
                  <div>
                    <p className="rule-t">{RULES[i][0]}</p>
                    <p className="rule-d">{RULES[i][1]}</p>
                    <p className="chip mono">{RULES[i][2]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <h2 className="text-28 mt-14">The Qloo calls</h2>
      <p className="mt-2 max-w-2xl text-ink-2">In the order a card is built.</p>
      <div tabIndex={0} role="region" aria-label="Scrollable table" className="panel mt-5 overflow-x-auto">
        <table className="tidy">
          <thead><tr><th>Step</th><th>Endpoint</th><th>What is sent</th><th>What comes back</th></tr></thead>
          <tbody>{CALLS.map((r, i) => (
            <tr key={r[0]}>
              <td><span className="rule-n">{num(i)}</span> <strong>{r[0]}</strong></td>
              <td><span className="chip mono" style={{ marginTop: 0 }}>{r[1]}</span></td>
              <td>{r[2]}</td>
              <td>{r[3]}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-4 text-ink-2 max-w-2xl">Calls are spaced at least 250 milliseconds apart, a rate limit response is never retried automatically, repeated requests share one call, and answers are cached on the server for a day. The exact parameters and which ones Qloo ignored are in the platform probe.</p>

      <h2 className="text-28 mt-14">Two labelled layers on every item</h2>
      <div className="grid gap-6 mt-5 md:grid-cols-2">
        <div className="panel p-5"><p className="kicker">From Qloo</p><p className="mt-2">The item, its year, its tags and its affinity. Shown as returned.</p></div>
        <div className="panel p-5"><p className="kicker">Added by Aftersong</p><p className="mt-2">The Personal, Shared era or Widely known tag, and the opener. Personal means the item ranks clearly higher for this person than for Qloo's 55 and older audience. Widely known means Qloo reports high popularity.</p></div>
      </div>
    </div>
  );
}
