# PROGRESS.md

Updated at the end of every working session.

## Standing rules (from Kinnoski, apply to every phase)
- All files and folders live inside `AFTERSONG/`.
- Nothing about other entries appears in committed code, UI, README or docs. Study material stays in `reference/` (gitignored). `scripts/check-clean.mjs` enforces this from `reference/blocked-terms.txt`, in the pre-commit hook.
- The word "fictional" never appears in the README, UI, voiceover, demo video or submission text. The disclosure that the persona and sample data are invented lives only in `EVIDENCE.md`. This replaces the "labelled fictional" wording in the build instruction. The "Sample" label on sample screens stays.
- Every commit is authored by 0xkinno. No AI attribution anywhere.
- House style: no dashes as punctuation, no emoji, no hype words.
- Study `HACKATHON_WINNING_SYSTEM_V5 (1).md` (revision 5.1, the larger file), not the older copy.

## Session 3, 2026-10-29: Phase 8 and the first live run
Done and verified:
- Follow-up 01 added as Phase 8 of the task list. A, B, D, E (code and hash check), F, G, H are built with tests: 72 backend tests, 2 MCP tests, 71 browser checks.
- Pushed to https://github.com/0xkinno/aftersong. Every commit is authored by 0xkinno. `.env` is ignored; only `.env.example` is tracked.
- Vercel project `aftersong` linked from `web/`; production variables set: SUPABASE_URL, SUPABASE_ANON_KEY, BACKEND_SHARED_SECRET. Git auto-deploy is switched off (`vercel.json`). **Not deployed.**
- First live run: `npm run probe` (23 probes, 0 failed) and a live build of the sample card for Walter with the real model: 8 items, six offline checks pass on the exported card. Measured behaviour is in PLATFORM_PROBE.md and each item became a rule with a test.

What the live run changed (each now a rule with a test):
- Artists carry start_year and end_year, so music is windowed by active years. Music strategy: property.
- The age signal alone is refused by Qloo (400). The cohort ranking runs over a pinned pool.
- Page size is capped at 50, which had left half of a pinned pool unranked.
- A locality id for San Antonio, Texas resolved to a village in Mexico and returned no places; the resolver now picks by region and sends a point.
- Popularity is a percentile (most results above 0.97), so Widely known is the top quarter of each pool.
- Food abstains when no nearby place carries the hometown cuisine tag, instead of showing an unrelated place.
- The abstention preset uses birth year 1900: even 1925 still returned a full card. Abstention happens per domain.

First measured results (2026-10-29, curated forms only): FINDINGS.md F1 to F5 are generated and docs/FACTS.json is filled for the Aftersong arm. The plain AI arm ran on 2026-10-30 for all 15 curated forms with Gemini, see EVIDENCE.md.

Not done:
- `scripts/probe-matrix.mjs` and `scripts/eval.mjs` have not been run. They refuse until `docs/PREREG.md` and `data/eval/PREREG.sha256.json` are committed (commit them first, then run). FACTS.json, FINDINGS.md and the landing discovery sentence stay empty until then.
- No Vercel production deploy, and no Render service. The backend is a separate Node service (see the architecture note in the session report).
- harness-check.mjs was written first and run on 2026-10-30 (see Session 7).
- Three older participants recorded on 2026-10-29 (see Session 5); session on 2026-10-29, 1 hour, no measured outcome.

## Where things stood after session 2, 2026-10-28
Phases 0 to 7 are built as far as they can be without keys and accounts. Everything that needs the
Qloo key, a model key, Supabase, GitHub, Vercel or Render is listed under "Blocked on Kinnoski".

| Phase | State |
|---|---|
| 0 Foundation | Done except the Vercel and Render deploy |
| 1 Sponsor intelligence and probe | Intel done from docs and package source. Probe script written and tested for its keyless path; real calls wait for the key |
| 2 The card | Code, rules, agent, UI built and tested on stand-ins. Not yet run on live Qloo |
| 3 Human loop | Built and tested at service level; family page and session mode checked in the browser. Carer pages and Supabase untested until a project exists |
| 4 Group and compare | Built and unit tested. Live runs wait for the key |
| 5 Proof | Sources verified. Eval and facts scripts written. No eval run, so FACTS.json is empty and the site says "not measured yet" |
| 6 UI and quality | Landing, all pages, house-style test, 51 Playwright and axe checks across five viewports pass. Screenshots wait for real data |
| 7 Red team and submission | README, SUBMISSION_DEVPOST.md, PITCH.md written. Red team, submit and tag wait for the deploy |

## Verification so far
- `npm test`: 78 backend and 2 MCP tests pass at the last run (35 at first write) (client, rules, memory, agent with a scripted model, fault switch, room planner, plain AI check, service roles).
- `npm run verify:fixtures`: honest synthetic card passes all six checks; tampered card fails as expected.
- `web/e2e/quality.spec.ts`: 51 tests pass on a stack running a synthetic Qloo stand-in: no horizontal scroll, no overlap, axe with no serious violations, hover glow, at 375x812, 412x915, 768x1024, 1280x800 and 1440x900.
- `npm run check`: house style, no study material in committed files, FACTS, SDK_SURFACE and README current.
- The stand-in Qloo is `scripts/dev-mock-qloo.mjs`. Its data is invented, never deployed, and never used for a result or a screenshot in the README.

## Plan and build diff (V5 rule: every session)
Claims checked against code this session:
- THESIS.md says the agent has Intake Clerk, Era Scout, Card Builder, Room Planner, Memory Keeper and Opener Writer roles. In code these are tools of one agent loop plus `plan_group_session` invoked by the group route, not a model-chosen tool. The group route is deterministic; it is listed that way in SDK_SURFACE.md ("Room planner re-scoring"). THESIS.md now says the crew table is responsibilities inside one loop, not separate model identities.
- SPONSOR_INTEL.md says the harness is not wired. Code agrees.
- The build instruction prefers the harness MCP. Not used; reason recorded.
- The build instruction asks for a hero image. Not made: no image model in this environment. Hero art is the inline SVG only.
- Invariant 2 applies to dated items. Food and place items are tied to a hometown cuisine or place instead, because Qloo places have no year. Recorded in README Limits and RISK.md.
- `upset` memory does not expire on its own (stricter than the 90 day rule). Recorded in `backend/src/core/memory.ts`.

## Self-judging, 1 to 5, this build (V5 Part 17)
Comparison scores are kept locally in `reference/`.

| Criterion | Score | Evidence | What moves it |
|---|---|---|---|
| Technological Implementation | 3 | Rules, window, cohort split, same-pool re-scoring, allowlist, rate discipline, tests, SDK surface with file and line | A live probe and eval on our own key; the music years strategy |
| Design | 4 | Calm editorial UI, phone first session mode, print layout, five viewports and axe pass | Real data in screenshots; a real session on a phone |
| Potential Impact | 4 | Specific person and moment, verified sources, buyer and price hypothesis, carer role | A practitioner interview or one real session |
| Quality of the Idea | 4 | Year windows across five kinds of item, Personal against generation, carer taps as the next signal | The measured comparison against the plain AI list |

Blocking questions answered "no" today: wild set or real run (none), both error directions (none),
plain AI comparison (needs a model with quota), deployed on Vercel and Render (not yet), red team on the deployed app
(not run), unattended run recorded (not yet), screenshots of the deployed app (local screenshots only, in docs/screens).
Done since the first score: live Qloo observed (probe, matrix F1 to F5, discovery run, 15 curated cards).

## Session 4 (2026-10-29)
- CI fixed: the browser job ran Playwright from the repository root, which pulled in the MCP test without its dependencies. It now runs from `web/`.
- README rewritten: problem table reorganised (Topic, Finding, Source), landing banner and four screenshots (Playwright, Chromium), findings table generated from docs/FACTS.json, real-person section restored.
- Screenshots taken locally against the real backend and live Qloo, with the model out of quota (cards show template openers, labelled as such).
- DISCOVERY.md run log filled from `node scripts/discovery.mjs`.

- Landing redesign (dark stage, title-case headline, larger record, sample cards), 71 browser checks pass. Groq and Gemini fallback added to the model adapters.

## Blocked on Kinnoski
1. Render service from `render.yaml`, then `BACKEND_URL` in Vercel (the web app is live at https://aftersong.vercel.app and shows the saved-sample states until then).
2. Render service from `render.yaml`, then `BACKEND_URL` in Vercel. Until then the deployed app shows saved samples only.
3. Supabase: run `supabase/schema.sql` (the `records` table returns 404 today).
4. Model quota: a `GROQ_API_KEY` or `GEMINI_API_KEY` in `.env` (now supported as fallbacks), or OpenRouter credits, then `npm run eval` and `node scripts/facts.mjs` for the plain AI columns and sign tests.
5. Push: `git push origin main` if a push from here fails for credentials.
6. Wild forms: 10 to 15 consenting older relatives into `data/wild/*.json`.
7. Human review of the plain AI list and of Aftersong's rejections, for both error directions.
8. A real consented session. The final Devpost submit click.

## Notes
- The rules page lists a demo link, a public repository with a visible licence, and a text description. A video is not listed as required.
- Music years: the code supports three strategies (a year property, a decade tag, or none). The probe decides which one holds; until then the card may show fewer music items.
- Adjacent music-and-dementia products exist in the real world (details in `reference/LANE_MAP.md`). The pitch should acknowledge playlist apps fairly.

## Session 5, 2026-10-29
Done:
- Backend deployed on Render at https://aftersong-backend.onrender.com. `/health` answers 200; `/status` (with the shared secret) reports Qloo ok, storage `supabase`, public lock on.
- Supabase schema run by 0xkinno; site URL set.
- /method and /evidence redesigned (grouped rule panels, stat rows, tidy tables, sessions and error-review panels).
- Three older participants recorded (OP-01 to OP-03) in `docs/sessions.json`; count and shortfall flow into `docs/FACTS.json`, EVIDENCE.md and README.

Open:
- Real-world forms: 3 of 15 recorded, 12 short. Their intake details are not in the repo, so the wild eval set is still 0 forms.
- Human error review: not carried out before submission; no counts exist. Both directions stay "not recorded". The plain AI false positive rate stays unmeasured.
- Session date 2026-10-29, length 1 hour (supplied by the project lead).
- Plain AI arm: done on 2026-10-30, see Session 7.
- `BACKEND_URL` in Vercel points at the Render service (done).
- Groq and Gemini keys are now in `.env` (gitignored).

## Session 6, 2026-10-29 to 2026-10-30
- Model fix: Gemini and Groq ids were retired. The adapters now ask the provider which models the key can use and try the best few; each model has its own time limit; the fallback that answered is reused for ten minutes. `/status` reports the model as working (gemini-3.6-flash).
- All five sample cards were rebuilt with the working model (model-written openers; one template line on Walter's card).
- Live end-to-end walk with Playwright Chromium on https://aftersong.vercel.app: `web/e2e-live/live.spec.ts`, 9 of 9 pass. The compare button hit the per-visitor cap in the browser after earlier runs, so the plain AI run was also checked once through the backend with a fresh visitor id (it ran and applied the rules).
- Red team round 1 (five judges) run; see REDTEAM_LOG.md. Round 2 not run.
- Participant notes updated: OP-01 easy, OP-02 small early difficulties, OP-03 confused at first and understood by day two. Still open: human error review counts, session date and length, plain AI arm in the eval, 12 more forms.

## Session 7, 2026-10-30
- Plain AI comparison ran on all 15 curated forms with one model (recorded in docs/eval-summary.json as Groq openai/gpt-oss-120b). Internal comparison: authors' forms, authors' checker.
- Session recorded as 2026-10-29, 1 hour. Human error review not carried out; no counts. 12 more real forms left for after submission.
- Planning files moved to the gitignored reference/planning folder.
- Red team round 2 and a final round run against the live site; fixes and open items are in REDTEAM_LOG.md. Fixed here: proxy path traversal, stale evidence lines, openers must be real questions that name the item, unsuitable tags hidden, validation before a build credit.
- Model reliability: a free-tier model id (":free") is now tried after any credited key; model notes on cards no longer carry provider error text (it goes to the server log).
- Sample cards: all five are built with the live model and Qloo, saved, and open at once with a "Saved card, built <date>" line and a "Rebuild live" button. A GitHub Actions job pings the Render backend every ten minutes to keep it warm. deploy-check passes on the web app and the backend.
- Harness equivalence check run with @qloo/qloo-harness 0.1.26 on our key: same top entity for a lookup, 10 of 10 recommended ids shared. Recorded in SDK_SURFACE.md and PLATFORM_PROBE.md; the surface table has no empty Status cell.
- README: the measured block says the wild set is not run yet; a line explains that links cross domains.
- Demo film built in reference/video (gitignored): 1920x1080, 170 s, about 40 MB, voice about 2:40. Not yet uploaded; the README Video row stays "not recorded yet" until a public link exists.
