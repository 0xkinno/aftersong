# DISCOVERY.md (Gate G3)

## The primitive that is the only practical instrument
Qloo's affinity graph queried across domains inside a year window: `/v2/insights` with
`signal.interests.entities` (the person's favourites), `filter.release_year` (film and television), a
cohort signal `signal.demographics.age=55_and_older`, and `filter.results.entities` to re-score one pool
under both signals. A plain model cannot produce the cohort-versus-personal split, because it has no
affinity data for people of a given generation.

Deep rung used: same-pool re-scoring under two signals, explainability, hometown as a locality signal.
Newest rung: the cohort signal combined with the person's own signals on a year window, and a carer's
logged reactions fed back as the next `signal.interests.entities`.

## Minimal script
`node scripts/discovery.mjs` resolves two favourites, builds the three dated pools for a resident born
in 1940, and prints counts: candidates, how many fall inside the window, how many are Personal, Shared
era or Widely known, and how much of his top ten the 55 and older audience also ranks in its top ten.

<!-- run:start -->
Run 2026-10-29T03:46:01.507Z. Resident born 1940, window 1950 to 1970, two confirmed favourites. Counts only.

| Domain | Candidates | Inside the window | Personal | Shared era | Widely known | Top 10 shared with the 55 and older audience | Qloo calls |
|---|---|---|---|---|---|---|---|
| music | 50 | 30 | 3 | 8 | 13 | 3 of 10 | 4 |
| film | 35 | 35 | 3 | 4 | 9 | 4 of 10 | 4 |
| tv | 47 | 47 | 9 | 6 | 11 | 2 of 10 | 4 |

Command: `node scripts/discovery.mjs`
<!-- run:end -->

## Delete test
Remove Qloo and step 3 of the card fails: with no Qloo response there is no entity id for any item, so
every candidate is rejected as `not_qloo_entity`. Tests that fail without Qloo:
- `the confirmed favourite itself is never recommended; an entity Qloo did not return is refused` in `backend/test/core.test.ts`.
- `fault switch: a model that injects an off-card name and entity is blocked by invariant 5` in `backend/test/agent.test.ts`.
Remove the cohort signal and the Personal tag cannot be computed: `labels` in `backend/test/core.test.ts`.

## Textbook check
Re-ranking a candidate pool for several users is a known pattern. Here it is a component of the room
planner, not the headline. The headline is a session built from one person's years and taste.

## Mode
Mode A with G. No contradiction in the sponsor is claimed.
