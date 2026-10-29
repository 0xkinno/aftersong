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
reported by 0xkinno. The session date and the session length were not supplied, so neither is stated.

| ID | What they reported |
|---|---|
| OP-01 | Said the app was easy to understand. Reported no moment of confusion and said everything went smoothly. No criticism was reported. |
| OP-02 | Said the app was easy to understand. Reported no moment of confusion and said everything went smoothly. No criticism was reported. |
| OP-03 | Said the app was easy to understand. Reported no moment of confusion and said everything went smoothly. No criticism was reported. |

What this does and does not show: all three gave the same answer about ease of use, and none raised a
criticism. That is a small group describing their own experience. No task was timed, no outcome such as
mood or recall was measured, and no claim is made that Aftersong helped anyone. Per-person quotes, the
items shown and any "no response" moments were not supplied, so they are not recorded here.

Real-world forms: target 15, recorded participants 3, shortfall 12. The three participants' intake
details (birth year, favourites, hometown) are not in the repository, so the wild eval set still has 0
forms and the wild columns stay "not measured yet".

## Both error directions
Not recorded. A human reviewer has not supplied counts, so nothing is claimed. To be recorded with the
reviewer, the date, the counts and examples:
- Items Aftersong rejected that the reviewer would keep (false rejections): not recorded.
- Items Aftersong kept that the reviewer says are wrong (false keeps): not recorded.
- False positive rate of the checker on the plain AI list: unmeasured, because the plain AI arm has not run.

## Misses and limits
- **The plain AI arm of the eval has not run.** The free OpenRouter model hit its daily limit ("free-models-per-day") during the first runs, so the Aftersong arm was measured on 15 curated forms with no model (template openers), and the three-run plain AI comparison, its sign tests and the plain AI columns on /evidence are still "not measured yet". The first plain AI attempts were discarded: the model first returned empty text because it spent its token limit thinking, and then rate limited. Rerun with `npm run eval` once the model has quota; it overwrites this result.
- The wild set has 0 forms run through the eval; 3 older participants are recorded of a target of 15 (shortfall 12). Curated: 15 of 15 cards built, no thin cards, 109 items, 15.7 live Qloo calls per card, 15.5 seconds per card without a model.
- Findings F1 to F5 (see FINDINGS.md) were run once on the curated forms, before any wild form exists.
- Abstention preset, measured live on 2026-10-29: a resident born in 1925, and even one born in 1900, with an obscure favourite (Mildred Bailey), still got a card of 6 to 7 items. Qloo has data for those years. The abstention appears per domain (television and food for 1900), not as a thin card. The preset uses 1900 for that reason.
- Qloo's popularity is a percentile: nearly every older artist and film it returns is above 0.97. "Widely known" is therefore the top quarter of each pool, not a fixed number.
- A search for a nonsense name still returns five near names, so "not found" means "no exact name", and nothing is used until a carer confirms.
- Qloo has no year filter for artists. How music years are obtained is decided by the probe and recorded in `PLATFORM_PROBE.md`.
- The harness was not used; see `SPONSOR_INTEL.md` for the reason.
- Carer sign-in and saved residents were tested with a stand-in sign-in and an in-memory store; they are untested against Supabase until a project is connected.
- Three older participants are recorded, with no date or length supplied and no measured outcome. See Real session.

## Run log of unattended work
The weekly family note runs Monday 07:00 UTC from a Render cron job. Run records are stored in the
`runs` collection and listed here once a real run exists.
