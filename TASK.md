# TASK.md

Mark each task `[x]` the moment it is finished and verified.

### Phase 0: Foundation
- [x] G0: `RULES_EXTRACT.md` and `LANE_MAP.md` (lane map stays in `reference/`)
- [x] Repo init, MIT licence, `.gitignore` with `reference/`, `.env*`
- [x] Attribution guard: workflow, commit-msg hook, git identity set to 0xkinno
- [x] Name collision check for "Aftersong"; record result
- [ ] Empty Next.js app deployed to Vercel at its final URL; empty Render service live; `/api/status` probing both

### Phase 1: Sponsor intelligence and probe
- [ ] G1 `SPONSOR_INTEL.md`: Qloo thesis, harness workflows, newest releases, depth ladder
- [ ] G5 `PLATFORM_PROBE.md`: real calls for `/search`, `/v2/tags`, `/v2/insights` per entity type, release-year filter per type, explainability, popularity, harness MCP tools; record what works and what 404s
- [ ] Decide music era strategy from probe results and write it down

### Phase 2: The card, end to end on real Qloo
- [ ] Qloo client with cache, de-duplication, spacing, typed errors
- [ ] Rule engine with the six invariants and unit tests
- [ ] Agent with the five tools; model writes openers only
- [ ] Session Card screen and print layout
- [ ] Hard-case path shows "could not find" honestly

- [ ] Personal / Shared era / Widely known split via cohort signal and same-pool rescoring (5.6.1)
- [ ] Hometown thread via locality resolution and coordinates (5.6.2)
- [ ] Abstention screen with consented window widening (5.6.8)

### Phase 3: The human loop
- [ ] Supabase schema, RLS, magic link
- [ ] Family intake link and carer role, separated permissions (5.6.5)
- [ ] Session mode (phone first) with six observation taps
- [ ] Observations feed the next card as new signals, with the visible walk (5.6.3); `upset` suppression; 90-day expiry
- [ ] Resident timeline, family weekly digest, family view and delete
- [ ] Life-story PDF export (5.6.7)

### Phase 4: Group sessions and compare
- [ ] Room planner with maximin, upset veto and per-resident coverage (5.6.4)
- [ ] Plain-AI comparison panel with the same rules
- [ ] Offline verifier `scripts/verify-card.mjs` in CI (5.6.6)

### Phase 5: Proof
- [ ] `docs/SOURCES.md` with verified links
- [ ] Eval set: 15 curated, 15 wild forms (consent recorded)
- [ ] `scripts/eval.mjs` and `scripts/facts.mjs` write `docs/FACTS.json`; CI fails on mismatch
- [ ] Fault switch test; both error directions; misses listed in `EVIDENCE.md`
- [ ] `PROOF.md` with commands to reproduce every number

### Phase 6: UI and quality
- [ ] Landing page per Section 9 with hero SVG and image
- [ ] House-style test (fails on dashes, emoji, banned words; also filters model output)
- [ ] Playwright and axe on all five viewports, screenshots saved
- [ ] `/judge`, `/method`, `/sample` complete; public lock and daily caps on live Qloo use

### Phase 7: Red team and submission
- [ ] Five judge-agent rounds (V5 Appendix B) on the deployed URL until clean; log in `REDTEAM_LOG.md`
- [ ] README per Section 10
- [ ] `SUBMISSION_DEVPOST.md` mirroring the live form
- [ ] Ask Kinnoski, then submit at least 2 hours before Oct 31, 4:45 am WAT
- [ ] Tag the commit, freeze the deployment
