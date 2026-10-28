export const metadata = { title: "Method, Aftersong" };

const RULES = [
  ["The window", "A resident's window is the years they were 10 to 30 years old. The carer can move it between 5 and 35. It is a hard filter: anything outside is rejected in code, with the reason shown.", "backend/src/core/window.ts"],
  ["Real entities only", "Every item must be an entity Qloo returned in this build. A name the model makes up cannot become an item.", "backend/src/core/rules.ts"],
  ["Tied to a favourite", "Every item must be scored by Qloo against a favourite the carer confirmed, or against something the carer saw work.", "backend/src/core/rules.ts"],
  ["Nothing that upset", "An item marked upset is removed for that resident for good, and items that share two or more tags with it count for less.", "backend/src/core/memory.ts"],
  ["Openers name nothing else", "The model writes one line per item. A line that names anything not on the card, makes a health claim, or breaks house style is replaced by a template line, and the card says so.", "backend/src/core/openers.ts"],
  ["Qloo sees only IDs", "Requests to Qloo may carry entity IDs, tag IDs, an age bracket, years, and a place as an ID or a point. Names and health details cannot leave.", "backend/src/qloo/guard.ts"],
  ["Not enough is an answer", "When fewer than six items survive, the card says so and offers a five year widening. It never pads.", "backend/src/core/card.ts"],
  ["Memory is the carer's taps", "Six reactions, stored with who, when, card and item. Positives become new signals. Entries expire after 90 days unless logged again. The family can view and delete them.", "backend/src/core/memory.ts"],
];

const CALLS = [
  ["Resolve favourites", "/search", "The typed name, optionally an entity type", "Entity IDs the carer confirms"],
  ["Tags", "/v2/tags", "A short phrase, semantic search on", "Tag IDs for cuisines and genres"],
  ["Hometown and home city", "/search with a locality type", "The place name", "A locality ID, sent onward as an ID"],
  ["Music, film, television", "/v2/insights", "filter.type, signal.interests.entities, filter.release_year (film, TV), feature.explainability", "Ranked entities with affinity, popularity and tags"],
  ["His generation", "/v2/insights", "The same filters with signal.demographics.age=55_and_older and no favourites", "The cohort's ranking of the same kind of item"],
  ["Same pool, both scores", "/v2/insights with filter.results.entities", "The items missing from one list", "A score for every item under both signals"],
  ["Food near him, places from home", "/v2/insights", "filter.tags (cuisine), signal.location (a locality ID)", "Places and destinations tied to home"],
  ["Not repeating", "/v2/insights with filter.exclude.entities", "IDs the carer marked upset", "Results without them"],
];

export default function Method() {
  return (
    <div className="wrap py-10">
      <p className="kicker">Method</p>
      <h1 className="text-40 md:text-64">Every rule and every call</h1>
      <p className="mt-3 max-w-2xl text-ink-2">The agent chooses which tools to call and in what order. It does not choose what goes on the card. Rules in code do, after Qloo answers, even when the same limit was sent as a filter.</p>

      <h2 className="text-28 mt-12">The rules</h2>
      <div className="overflow-x-auto mt-4">
        <table><thead><tr><th>Rule</th><th>In plain words</th><th>File</th></tr></thead>
          <tbody>{RULES.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td className="mono text-12">{r[2]}</td></tr>)}</tbody></table>
      </div>

      <h2 className="text-28 mt-12">The Qloo calls</h2>
      <div className="overflow-x-auto mt-4">
        <table><thead><tr><th>Step</th><th>Endpoint</th><th>What is sent</th><th>What comes back</th></tr></thead>
          <tbody>{CALLS.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="mono text-12">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody></table>
      </div>
      <p className="mt-4 text-ink-2 max-w-2xl">Calls are spaced at least 250 milliseconds apart, a rate limit response is never retried automatically, repeated requests share one call, and answers are cached on the server for a day. The exact parameters and which ones Qloo ignored are in the platform probe.</p>

      <h2 className="text-28 mt-12">Two labelled layers on every item</h2>
      <p className="mt-3 max-w-2xl">What Qloo returned (the item, its year, its tags, its affinity) is separate from what Aftersong adds (the Personal, Shared era or Widely known tag, and the opener). Personal means the item ranks clearly higher for this person than for people of his generation. Widely known means Qloo reports high popularity.</p>
    </div>
  );
}
