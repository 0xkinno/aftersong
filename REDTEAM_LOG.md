# REDTEAM_LOG.md

Five fresh judge agents, one role each (rubric judge, ten-minute judge, sponsor maintainer, verifier,
skeptic), run on the deployed URL only, using the prompt in V5 Appendix B. Fix, redeploy, repeat until a
round comes back clean.

## Status
Round 1 run on 2026-10-29 against https://aftersong.vercel.app, five fresh judge agents, one role each. Round 1 was not clean. Fixes are listed below; a second round has not been run.

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
- Rules, memory, room planner, agent loop, fault switch, verifier: `npm test`, 35 tests.
