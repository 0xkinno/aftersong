# SPONSOR_INTEL.md

What Qloo offers, what the event kit supports, and how deep Aftersong goes. Read on 2026-10-28 from the
Qloo developer guide, the Entity Type Parameter Guide, the Parameter Reference and the published
`@qloo/qloo-harness` 0.1.26 package. Items marked "documented" have not been called on our own key yet;
`PLATFORM_PROBE.md` records what the live API did.

## Qloo's thesis
Qloo describes aggregate cultural affinity: given entities, tags, an age bracket or a place, it returns
other entities ranked by how strongly people who like the inputs also like them, across domains (music,
film, television, books, places, brands, podcasts, games, destinations, people). The brief's own test:
if the submission would work the same without Qloo, it is the wrong thing.

## Sponsor and founder words (read 2026-10-28, qloo.com home page; no founder posts from the last 90 days were reachable)
- Mission line on the site: "AI to understand the world around us." Cultural graph plus taste intelligence.
- Agent pitch, heading "Give agents a heart": agents should understand the people they serve, not just follow instructions. Capability named "AI & Agent Grounding".
- Privacy thesis: cultural relevance is inferred from entities, relationships and context, without identity-level profiles; privacy is "a system boundary, not a policy layer".
- Capabilities listed: Cultural Data Enrichment, Taste Intelligence (why people like what they like), Recommendations (cross-category from one or many signals), Locality Intelligence, AI & Agent Grounding, On-Device Intelligence.
- Event: "Agents, but with taste", Sep 30 to Oct 30, 2026. Gartner 2026 Emerging Tech mention and client stories (Match Group, Michelin) are on the home page. A Special Olympics collaboration was covered by Forbes in 2024 (inclusion and care are in the sponsor's own history).
- Not found: founder interviews, a changelog, or release notes outside the npm package. The harness version (0.1.26) and its tool list are the newest release evidence available.

How Aftersong maps to these words: the "heart" is a person in a care home; the privacy boundary is code
(`backend/src/qloo/guard.ts` refuses anything but IDs, tags, age bracket, years and a place); the
grounding is a card where every item is a Qloo entity inside the person's years.

## Past winners of this sponsor
A previous Qloo LLM hackathon ran (Devpost lists $25,000 in prizes and 2,851 participants). Winner
details were not reachable. Public entries seen use Qloo for dining and travel recommendations
(entity affinity for places and destinations). None of those found used year windows, cohort signals or
a carer feedback loop. Treat the depth ladder below as the differentiator, and do not claim more than
the ladder shows.

## Availability
Hackathon host only. Key by Google form, issued by email within a few business days. Quota and rate
limit set "high enough for typical projects", per-second limit about 5. Keys end after judging.

## Surfaces
| Surface | Use | Status for us |
|---|---|---|
| REST `https://hackathon.api.qloo.com`, header `X-Api-Key`, GET only | `/search`, `/entities`, `/v2/tags`, `/v2/tags/types`, `/v2/insights`, `/v2/audiences`, `/v2/analysis/compare`, trends | Used directly from our backend |
| `qloo mcp` (harness 0.1.26, stdio) | Validated workflow tools: `qloo_search`, `qloo_describe`, `qloo_find_tags`, `qloo_insights`, `qloo_rank`, `qloo_recommend`, `qloo_compare_audiences`, `qloo_audience_demographics`, `qloo_trends`, `qloo_where_popular`, `qloo_entity`, `qloo_entity_tags`, `qloo_analyze`, `qloo_capabilities` | Studied, not wired. See the decision below |
| `qloo explore`, `qloo exec`, `qloo api` | Terminal use | Used by hand for checks only |
| docs MCP `https://docs.qloo.com/mcp` | Reference only. Its `execute-request` tool must not be used | Reference only |

Decision on the harness: the build instruction prefers the harness MCP on the backend. The harness client
retries 429 and resolves lookups concurrently, which the event's own rate limit punishes. We call the
documented REST endpoints through our own client (250 ms spacing, no 429 retry, batched `/entities`,
24 hour private cache, daily cap). The harness is not claimed anywhere. If time allows after the key
arrives, one harness workflow (`qloo_compare_audiences`) may be added behind a flag and recorded in
`SDK_SURFACE.md`.

## Limits and rules that shape the design
- Hackathon keys work only on the hackathon host. 401 means wrong host or key.
- `/v2/insights` is GET. Invalid parameters are silently ignored, so every filter is also enforced in code.
- Rate limit about 5 requests per second (reported by Qloo support). Spacing 250 ms. A 429 is never retried automatically.
- Private server-side caching of responses is allowed. **Qloo response data must not be stored in a public repository.** Consequence: committed test fixtures are synthetic, and real responses live in the backend store and a gitignored `data/` folder.
- Safe use: no names, emails, device or account IDs, location histories or health data to Qloo. Aftersong sends entity IDs, tag IDs, an age bracket, years, and a locality ID or a point.
- Insights supports these entity types: artist, book, brand, destination, movie, person, place, podcast, tv_show, video_game. `urn:entity:music` and `urn:entity:food_and_drink` are wrong.

## Parameter facts that decide the design (documented)
| Need | Parameter | Types that accept it |
|---|---|---|
| Year window | `filter.release_year.min` / `.max` | movie, tv_show |
| TV run | `filter.finale_year.min/.max`, `filter.latest_known_year.min/.max` | tv_show |
| Year window for books | `filter.publication_year.min/.max` | book |
| **No year filter** | none | **artist**, place, brand, podcast, destination |
| People by birth year | `filter.date_of_birth.min/.max`, `filter.date_of_death.min/.max` | person |
| Age cohort | `signal.demographics.age` = `24_and_younger`, `25_to_29`, `30_to_34`, `35_to_44`, `45_to_54`, `55_and_older` | all insight types |
| Re-score a fixed pool | `filter.results.entities=<ids>` | all insight types |
| Why a result ranked | `feature.explainability=true` | places confirmed by others; probe for the rest |
| Popularity ceiling | `filter.popularity.max` and the `popularity` field | all |
| Hometown | `signal.location` (WKT POINT or a locality ID), `signal.location.query` (fuzzy locality name) | all insight types |
| Exclude | `filter.exclude.entities`, `filter.exclude.tags` | all |
| Tags | `/v2/tags` with `filter.query`, `feature.semantic_search`, `take`; `filter.tag.types` | lookup |
| Entities by ID | `/entities?entity_ids=` (batch) | lookup |

The oldest age bracket is `55_and_older`. For a resident born in 1940 that is the right cohort signal.

## The depth ladder (what Aftersong uses, shallowest to deepest)
1. `/search` to resolve the carer's typed favourites to entity IDs, carer confirms.
2. `/entities` batch lookup for properties (year, popularity, tags).
3. `/v2/insights` with `signal.interests.entities` per domain: artist, movie, tv_show, place.
4. Year windows via `filter.release_year` (film, TV), enforced again in code.
5. `/v2/tags` for cuisine and genre tag IDs, passed as `signal.interests.tags` and `filter.tags`.
6. Locality resolution then `signal.location` for the hometown thread.
7. Cohort signal `signal.demographics.age=55_and_older` against personal signals on the same window.
8. Same-pool re-scoring with `filter.results.entities` under both signals, giving Personal, Shared era, Widely known.
9. `feature.explainability` and `popularity` carried onto each card item.
10. Observation loop: carer-confirmed reactions become new `signal.interests.entities`; `upset` becomes `filter.exclude.entities`.
11. Room planner: one pool re-scored for each resident with `filter.results.entities`, maximin across residents.
12. Plain-AI counterfactual: each model-suggested item is looked up in Qloo and checked by the same rules.

## Newest releases and workflows noted
Harness 0.1.26 (event kit minimum). Workflow tools listed above. The kit supports read-only `explore`
only. `qloo_compare_audiences` maps to `/v2/analysis/compare`, `qloo_where_popular` to heatmaps.

## What is not claimed
Trends, audiences endpoints, heatmaps, books, podcasts, brands and video games are not used by the card.
They are listed in `SDK_SURFACE.md` as "not used, so not claimed".
