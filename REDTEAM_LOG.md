# REDTEAM_LOG.md

Five fresh judge agents, one role each (rubric judge, ten-minute judge, sponsor maintainer, verifier,
skeptic), run on the deployed URL only, using the prompt in V5 Appendix B. Fix, redeploy, repeat until a
round comes back clean.

## Status
Round 1 run on 2026-10-29 against https://aftersong.vercel.app, five fresh judge agents, one role each. Round 1 was not clean. Fixes are listed below; Round 2 was run on 2026-10-30 and was not clean either; see below.

## Round template
| Round | Date | Role | Scores (1 to 5 per criterion) | Defects found | Fixes | Re-score |
|---|---|---|---|---|---|---|
| 1 | 2026-10-29 | rubric | 3, 3, 3, 4 | Backend unreachable at the time; 20 percent claim unsourced on page; comparison empty | Backend deployed and wired; sentence now says what the 20 percent is measured against | Not re-scored |
| 1 | 2026-10-29 | ten-minute | 4, 3, 3, 4 | Saved sample card showed a model failure and template openers; compare empty before a live run; hero chip said 1952 to 1972 | Sample cards rebuilt with a working model; chip now 1950 to 1970; model fallback fixed | Not re-scored |
| 1 | 2026-10-29 | sponsor maintainer | 4, 4, 3, 4 | The 55 and older bracket is today's audience, not the 1925 to 1940 cohort; submission says "measured comparison"; stale SDK surface and probe rows | Open: wording on cohort to be corrected; see Open defects | Not re-scored |
| 1 | 2026-10-29 | verifier | not scored | README said no real session while it also said three participants; participants are self-reported and identical; two overlap numbers in FACTS.json; hand-typed abstention figures | README row fixed; participant wording still identical until per-person notes exist | Not re-scored |
| 1 | 2026-10-29 | skeptic | not scored | Agent not visible on deployed sample; 20 percent is against a proxy list; comparison has no results; participant claim unverifiable | Sample rebuilt; sentence qualified; evidence page retitled so Aftersong columns are not read as plain AI results | Not re-scored |

## Open defects after round 1
- The cohort signal is Qloo's 55 and older audience, not the people who were young in the window. Method and README wording still say "his generation". To be reworded.
- The plain AI comparison has no data until a model arm runs; the submission text still points at it.
- `genericOverlapPct` (0, items common to most cards) and F2 overlap (20 percent, against a cohort-only list) are different measures stored under similar names.
- Abstention figures in EVIDENCE.md are typed from a live check, not generated.
- The three participant summaries are identical because no per-person notes were supplied.
- Cuisine filter and locality rows in SDK_SURFACE.md differ from what PLATFORM_PROBE.md found; to be reconciled.
- Pages load client-side, so a judge sees "Loading" for a few seconds.


## Local pre-checks done before the first round
These are not red-team rounds and do not count as one.
- Five viewports, axe, no horizontal scroll, no overlap, hover glow: `web/e2e/quality.spec.ts`, 51 tests.
- Rules, memory, room planner, agent loop, fault switch, verifier: `npm test` (35 tests at the time; 78 backend and 2 MCP now).

## Round 2 (2026-10-30, against https://aftersong.vercel.app and the repo)
Five fresh judge agents. The round was not clean. Most defects are open and are listed honestly rather than hidden.

Fixed after round 2:
- EVIDENCE.md had a stale hand-typed line (15 of 15 cards built); it now points to the generated FACTS.json.
- README said no session date or length and called the weekly note live; both corrected.
- /evidence now explains the nine model-error misses.
- A single-favourite card was labelled as using Qloo's explainability; it now says all signals (card.ts).
- Health claim check extended to might, may, could, can, feel better and help him relax.
- Opener claim wording in README and /method no longer says it blocks any name; one word names Qloo never returned are not caught.
- "always works" and "always opens" wording replaced; landing card tag "Some overlap" replaced with a real tag; "1 decisions" grammar; two stray screenshots untracked.
- Cohort wording: "his generation" replaced with Qloo's 55 and older audience everywhere; EVIDENCE.md states the proxy.
- `genericOverlapPct` renamed `commonItemsPct`; SDK_SURFACE notes for cuisine and the place point corrected.

Open after round 2 (not fixed before submission):
- The plain AI comparison now covers all 15 forms (Gemini). The rules favour a Qloo-connected list by construction and the forms and checker are the authors' own. Disclosed in EVIDENCE.md.
- Single word and lowercase names in openers are not caught; the health claim check is a list, not a proof.
- Upset items are blocked by Qloo ID only; a family link can delete an upset record; the plain AI arm does not exclude upset items.
- Music years accept any artist whose career overlaps the window.
- Family links have no expiry or revoke route; the public limiter is in memory.
- Pages show Loading for a few seconds before data arrives; /sample has no saved card, the saved card is on /compare.
- Explainability response shape is read heuristically; filter.location is not used.
- Human error review was not carried out; the 12 missing real forms are planned after submission.
