# EVIDENCE.md

Evidence, disclosures and measured results. Numbers are read from `docs/FACTS.json`, which a script
generates from real runs. Nothing in this file is typed by hand as a headline.

## Disclosures

### Persona and sample data
Marisol (activities coordinator) and Walter Okafor (resident) are invented people used to tell the
story and to preload sample data. They are not real, and no real person's data appears in the sample.
The four other sample residents (Ruth, Hector, Margaret, Joseph) are invented in the same way. This
wording lives only in this file. The README, the app, the voiceover and any demo video present them as
the story and the sample, with the on-screen word "Sample" on every screen that uses sample data.

### Curated and wild forms
The 15 curated intake forms in `data/eval/curated.json` were written by us from public biographical
archetypes (birth year, three well-known favourites, a hometown). They are flattering by construction
and are reported separately. Wild forms come from consenting older relatives or friends' grandparents
(first name, birth year, city, three favourites only) and are kept out of the repository; only
aggregates and hashed item ids reach `docs/eval-summary.json`. Until they are collected the wild set
reads "not run yet".

### AI assistance
AI coding assistants were used to write parts of this repository. All commits are authored by 0xkinno.

### Prior work and other events
This repository was started on 2026-10-28, inside the submission period. No earlier code is reused and
the project has not been entered in any other event.

### Qloo data handling
Qloo receives entity IDs, tag IDs, an age bracket, years, and a locality ID or a point. It also receives
the name a family typed for a favourite, in `/search`, and a place name in a locality search. No health
details, no resident names, no account data. The code refuses anything else before it leaves
(`backend/src/qloo/guard.ts`). The developer guide allows private caching and forbids storing responses
in a public repository, so none is stored here. Test fixtures are synthetic and say so.

## Results
Read from `docs/FACTS.json`; shown on `/evidence` and in the README.

## Real session
Three older participants have used Aftersong, recorded here by anonymous ID. The source is `docs/sessions.json`;
the count and shortfall are generated into `docs/FACTS.json` by `scripts/facts.mjs`. Recorded 2026-10-29,
reported by 0xkinno. The session took place on 2026-10-29 and lasted 1 hour.

| ID | What they reported |
|---|---|
| OP-01 | Said the app was easy to understand and reported no moment of confusion. No criticism was reported. |
| OP-02 | Faced some small difficulties at the start and got used to the app. |
| OP-03 | Was confused and felt lost at first, and understood the app by the second day. |

What this does and does not show: one participant found it easy from the start, and two had a learning
period, one of them confused and lost on the first day. That is a small group describing their own
experience, and it points to a first-use problem that needs fixing. No task was timed, no outcome such as
mood or recall was measured, and no claim is made that Aftersong helped anyone. Per-person quotes, the
items shown and any "no response" moments were not supplied, so they are not recorded here.

Real-world forms: target 15, recorded participants 3, shortfall 12. The three participants' intake
details (birth year, favourites, hometown) are not in the repository, so the wild eval set still has 0
forms and the wild columns stay "not measured yet".

## Both error directions
No human error review was carried out before submission, so there are no counts and none are claimed. A
review in both directions is planned after submission:
- Items Aftersong rejected that the reviewer would keep (false rejections): not recorded.
- Items Aftersong kept that the reviewer says are wrong (false keeps): not recorded.
- False positive rate of the checker on the plain AI list: unmeasured. It needs the human review, which was not carried out. The plain AI arm itself has run on 6 forms; see the limits below.

## Misses and limits
- **The plain AI arm ran on all 15 curated forms, with one Gemini flash model.** A first attempt on 2026-10-30 with a free OpenRouter model stopped after 6 forms at its daily limit; it was discarded and the whole set was rerun with Gemini so that every form uses the same model. The plain AI list is not the model used for the card openers in the deployed app, and the rules it is checked against include a link to a confirmed favourite through Qloo, which a plain list cannot satisfy by itself; that accounts for 30.8% not connected. Across 15 forms, 31.4% of plain AI items passed the same rules, 33.3% fell outside the years, and 21.1% were not found in Qloo. Aftersong cards carried 3.9 personal items each against 1.4 per plain AI run. The sign test on personal items per card is positive in 15 of 15 forms. The forms were written by the authors and the checker is the authors' own, so this is an internal comparison, not independent proof. The eval was re-run after the first results were seen.
- The wild set has 0 forms run through the eval; 3 older participants are recorded of a target of 15 (shortfall 12). Curated cards built, items, Qloo calls and build seconds are generated into `docs/FACTS.json` and shown on /evidence.
- Findings F1 to F5 (see FINDINGS.md) were run once on the curated forms, before any wild form exists.
- Abstention preset, observed by hand on one live run on 2026-10-29 (not generated by a script, so treat as an observation): a resident born in 1925, and even one born in 1900, with an obscure favourite (Mildred Bailey), still got a card of 6 to 7 items. Qloo has data for those years. The abstention appears per domain (television and food for 1900), not as a thin card. The preset uses 1900 for that reason.
- Qloo's popularity is a percentile: nearly every older artist and film it returns is above 0.97. "Widely known" is therefore the top quarter of each pool, not a fixed number.
- A search for a nonsense name still returns five near names, so "not found" means "no exact name", and nothing is used until a carer confirms.
- Qloo has no year filter for artists. How music years are obtained is decided by the probe and recorded in `PLATFORM_PROBE.md`.
- The harness was not used; see `SPONSOR_INTEL.md` for the reason.
- Carer sign-in and saved residents were tested with a stand-in sign-in and an in-memory store; they are untested against Supabase until a project is connected.
- Three older participants are recorded, from a one hour session on 2026-10-29, with no measured outcome. See Real session.

## Run log of unattended work
The weekly family note runs Monday 07:00 UTC from a Render cron job. Run records are stored in the
`runs` collection and listed here once a real run exists.

## Limits of the comparison signal
The "55 and older" age bracket is Qloo's audience today. It is not the group of people who were young in
1950 to 1970, so "Personal" means an item ranks clearly higher for this person's favourites than for that
audience. It is a proxy for the era, and no claim is made that it measures the era itself. The 20 percent
overlap in the findings is measured against a list built from that audience alone, not against a plain AI list.
