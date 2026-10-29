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
Not yet run with a real person. The plan: one 15 minute session with an older relative or neighbour, with
written consent, logged in the deployed app. No names, faces or health details will be published. This
section will report what happened, including every "no response" item. Until it does, nothing here
claims that Aftersong helped anyone.

## Both error directions
Not measured yet. They need a human reviewer over the plain AI list and over Aftersong's rejections.
Recorded here when done, with the reviewer, the date and the counts:
- Items Aftersong rejected that the reviewer would keep (false rejections): unmeasured.
- Items Aftersong kept that the reviewer says are wrong (false keeps): unmeasured.
- False positive rate of the checker on the plain AI list: unmeasured.

## Misses and limits
- Abstention preset, measured live on 2026-10-29: a resident born in 1925, and even one born in 1900, with an obscure favourite (Mildred Bailey), still got a card of 6 to 7 items. Qloo has data for those years. The abstention appears per domain (television and food for 1900), not as a thin card. The preset uses 1900 for that reason.
- Qloo's popularity is a percentile: nearly every older artist and film it returns is above 0.97. "Widely known" is therefore the top quarter of each pool, not a fixed number.
- A search for a nonsense name still returns five near names, so "not found" means "no exact name", and nothing is used until a carer confirms.
- Qloo has no year filter for artists. How music years are obtained is decided by the probe and recorded in `PLATFORM_PROBE.md`.
- The harness was not used; see `SPONSOR_INTEL.md` for the reason.
- Carer sign-in and saved residents were tested with a stand-in sign-in and an in-memory store; they are untested against Supabase until a project is connected.
- No real session with an older person has been run.

## Run log of unattended work
The weekly family note runs Monday 07:00 UTC from a Render cron job. Run records are stored in the
`runs` collection and listed here once a real run exists.
