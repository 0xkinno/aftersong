## Measured behaviour that changed the build
These came from the probe above and from raw exploration calls made the same day (2026-10-29) with our
own key. Each one is now a rule in code with a test (`backend/test/phase8.test.ts`).

1. **Artists carry a career span.** `properties.start_year`, and `end_year` or `year_of_death` when it ended. There is no year filter for artists (`insights.artist.releaseyear` returned the same results), so music is windowed in code: an artist counts when their career overlapped the window. Decade tags on artists are rare (0 percent in the probe). Music era strategy: **property**.
2. **The age signal alone is refused.** `signal.demographics.age` with no other signal or filter returns 400, "at least one valid signal or filter is required" (`cohort.alone`). It works with a year window (film, TV), with `filter.popularity.max=1` (artists), or with `filter.results.entities`. The cohort ranking therefore runs over a pinned pool.
3. **The people route needs full dates.** `filter.date_of_birth.min/max` with a bare year returned a 500; `YYYY-MM-DD` returned people. It is the fallback if an artist query returns no years.
4. **A locality id can return nothing for places; a point works.** The first search result for "San Antonio, Texas" was a village in Mexico. Its id returned 0 places, while a WKT point for San Antonio, Texas returned 20. The resolver now chooses the locality whose ancestors match the region typed and sends its point.
5. **Cuisine tags work as a signal.** As a hard filter together with a location they returned nothing in the earlier combinations, so cuisine tags are `signal.interests.tags`, not `filter.tags`.
6. **Places carry an address** (10 of 10 in `insights.place.cuisine`). That makes the hometown check (F5 in `docs/PREREG.md`) possible.
7. **Explainability is returned** for artist queries (`insights.artist.entities`). Per-signal scores are used where present.
8. **`/v2/analysis/compare` and `/v2/audiences` answer.** `/v2/trending` answered with 0 results for one artist and one month; it is not used by the product.
9. **A same-pool re-score returns every id asked for** (`insights.artist.rescore`, asked 5, got 5), so ranks inside each pinned call are available for the Personal and Shared era split.
10. **Page size is 1 to 50.** `take=51` and above return 400 ("take must be an integer value between 1 and 50"). A pinned pool is therefore capped at 50 and asks for exactly that many results; with the default page of 30 half of a 60 item pool came back unranked.
11. **Popularity is a percentile, not a spread.** For older music 44 of 50 results were at 0.99 or above; for 1950 to 1970 film every result was above 0.97; television spread from 0.04 to 0.98. A fixed "widely known" ceiling labels everything, so the ceiling is the top quarter of each pool.
12. **Names are not unique.** Searching "Sam Cooke" returns an artist, a person and three albums; "Casablanca" returns a film, three places and a locality; a dish returns books and restaurants. Samples, the eval and the try path choose the exact name with the order artist, film, television; a carer in the app always chooses by hand.
13. **A nonsense name still returns near names.** Searching a made-up string returned 5 results, none with that name. "Not found" therefore means "no exact name", and nothing is used until a carer confirms one.
14. **Food can honestly come back empty.** Places near San Antonio carrying a West African cuisine tag were not found in the first live card, so the food slot abstained instead of showing an unrelated place.
