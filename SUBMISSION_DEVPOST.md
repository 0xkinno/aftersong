# SUBMISSION_DEVPOST.md

Mirrors the Devpost entry form for the Qloo Agentic Hackathon. The live form's field names win: copy
each block below into the field of the same name, and check the live form for any field this file does
not list (custom questions, a video field, a track chooser). The rules page lists a demo link, a public
repository with a licence visible in About, and a text description as required; a video is not listed
as required.

**Project name:** Aftersong

**Tagline:** The songs he still knows: a reminiscence agent for memory care, built on Qloo.

**Inspiration:**
In dementia care, music is often the last thing to go. Most care homes play one playlist for everyone,
because the person running the session has twenty minutes and three lines from an intake form. We built
for that carer, someone caring for a person. The brief's own test is "if your submission would work the
same without Qloo, you're building the wrong thing." We chose the use where "actually good" matters most.

**What it does:**
An activities coordinator confirms up to five favourites for a resident. Aftersong works out the years
the resident remembers best (ages 10 to 30) and asks Qloo for music, film, television, food and places
inside those years, each tied to a favourite and tagged Personal, Shared era or Widely known by
comparing his taste with his generation's. The carer runs the session on a phone and taps one of six
reactions per item. Only her taps become memory: what lit up becomes the next signal, what upset is
never shown again. The family sees a weekly note and can delete anything logged. A one page "about me"
sheet goes to the next carer. A plain AI list for the same resident is checked by the same rules beside
the card, and a group planner finds items for a room of four to eight.

**How we built it:**
Next.js on Vercel, a Node service on Render that holds the Qloo key, Supabase for storage and carer
sign-in. The agent chooses which tools to call and writes one opener per item; rules in code decide
what goes on the card. Qloo calls: /search, /v2/tags, /entities, and /v2/insights with year windows,
a cohort signal, same-pool re-scoring with filter.results.entities, explainability, locality signals
and exclusions. Every call site with file and line is in SDK_SURFACE.md. Calls are spaced 250 ms apart,
never retried on a rate limit, cached for a day, and checked against an allowlist so only IDs, tags,
years, an age bracket and a place leave the server.

**Challenges:**
Qloo has no year filter for artists, so music years are checked in code from whatever year data comes
back, and the probe records which strategy worked. Invalid Qloo parameters are ignored silently, so
every filter is also enforced in code. The developer guide forbids storing Qloo responses in a public
repository, so our offline verifier runs on a card exported from the live app and the repository's
fixtures are synthetic.

**Accomplishments that we're proud of:**
See `docs/FACTS.json` and the evidence page for the measured comparison, with misses. A fault switch
lets a model try to put an off-card name on a card; the rules block it and the test shows the block.

**What we learned:**
Rules in code are what make a taste graph safe to use with people at the end of life: what the model
may say, what Qloo may receive, and what the carer alone may record.

**What's next:**
Group sessions across a floor, a family app to add memories, and an export for care plan software. A
pilot with three care homes, one session a week for a month.

**Built with:**
Qloo API, Next.js, React, Tailwind, Framer Motion, Node, Supabase, Vercel, Render, Playwright, axe-core.

**Try it out links:**
Live app: see `docs/deploy.json`. Judge walk: `/judge`. Repository: https://github.com/0xkinno/aftersong

**Testing instructions:**
No sign-in is needed. Open `/sample`, choose a resident, open the saved card, then try "Run the session on
a phone", "Compare with a plain AI list" and `/group`. Live builds are capped per visitor and per day;
the saved sample always opens. Offline checks: see JUDGE.md.

**Video:** not required by the rules text; link here if one is recorded.

**Image gallery:** docs/screens (real screenshots of the deployed app).

**Disclosures:** AI coding assistants were used; the repository started on 2026-10-28; see EVIDENCE.md.
