# REDTEAM_LOG.md

Five fresh judge agents, one role each (rubric judge, ten-minute judge, sponsor maintainer, verifier,
skeptic), run on the deployed URL only, using the prompt in V5 Appendix B. Fix, redeploy, repeat until a
round comes back clean.

## Status
Not started. The rounds need the deployed URL and live Qloo, so they begin after the first deploy.

## Round template
| Round | Date | Role | Scores (1 to 5 per criterion) | Defects found | Fixes | Re-score |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

## Local pre-checks done before the first round
These are not red-team rounds and do not count as one.
- Five viewports, axe, no horizontal scroll, no overlap, hover glow: `web/e2e/quality.spec.ts`, 51 tests.
- Rules, memory, room planner, agent loop, fault switch, verifier: `npm test`, 35 tests.
