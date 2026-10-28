# Qloo feedback

Friction found while building. Written from the documentation and the published harness package; items
that need a live key to confirm are marked and will be updated after the platform probe.

1. **No year filter for artists.** The Entity Type Parameter Guide lists `filter.release_year` for movies and TV shows and `filter.publication_year` for books, but nothing for artists. Music is the domain people with dementia respond to most. A debut year or active years filter on artists would remove most of the work we do in code.
2. **Invalid parameters are ignored silently.** The developer guide says so. A response header listing ignored parameters would let clients assert that a filter took effect. We re-check every filter in code for this reason.
3. **The harness retries 429 and resolves lookups concurrently.** Under a limit of about five requests per second that makes a cold ranking trip the limit. We call the REST endpoints with our own spacing instead. (Confirmed in the harness 0.1.26 source.)
4. **The per second limit was not in the developer guide.** It was learned from other teams' notes. A stated number and a `Retry-After` header would help.
5. **Explainability shape.** Needs a live response to document; pending the probe.
6. **Storing responses.** The developer guide allows private caching and forbids storing responses in a public repository. That is reasonable, but it means judges cannot be handed raw responses to verify against. Our offline verifier therefore uses a card export from the running app, and the repository's fixtures are synthetic.
7. **Docs navigation.** Some documented slugs return 404 from the sidebar links in the browser. The Parameter Reference loads its tabs (Filters, Signals, Output) client side, which hides the Signals table from text extraction.
