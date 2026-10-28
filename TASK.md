# TASK.md

Mark each task `[x]` the moment it is finished and verified.

### Phase 0: Foundation
- [x] G0: `RULES_EXTRACT.md` and `LANE_MAP.md` (lane map stays in `reference/`)
- [x] Repo init, MIT licence, `.gitignore` with `reference/`, `.env*`
- [x] Attribution guard: workflow, commit-msg hook, git identity set to 0xkinno
- [x] Name collision check for "Aftersong"; record result
- [ ] Empty Next.js app deployed to Vercel at its final URL; empty Render service live; `/api/status` probing both

### Phase 1: Sponsor intelligence and probe
- [x] G1 `SPONSOR_INTEL.md`: Qloo thesis, harness workflows, newest releases, depth ladder
- [ ] G5 `PLATFORM_PROBE.md`: real calls for `/search`, `/v2/tags`, `/v2/insights` per entity type, release-year filter per type, explainability, popularity, harness MCP tools; record what works and what 404s
- [ ] Decide music era strategy from probe results and write it down

### Phase 2: The card, end to end on real Qloo
- [x] Qloo client with cache, de-duplication, spacing, typed errors (verified with tests)
- [x] Rule engine with the six invariants and unit tests
- [x] Agent with the five tools; model writes openers only (verified with a scripted model; first live run pending the key)
- [x] Session Card screen and print layout (checked in the browser on stand-in data)
- [ ] Hard-case path shows "could not find" honestly

- [x] Personal / Shared era / Widely known split via cohort signal and same-pool rescoring (5.6.1) (unit tested; live check pending the key)
- [ ] Hometown thread via locality resolution and coordinates (5.6.2)
- [x] Abstention screen with consented window widening (5.6.8)

### Phase 3: The human loop
- [ ] Supabase schema, RLS, magic link
- [x] Family intake link and carer role, separated permissions (5.6.5) (service tests)
- [x] Session mode (phone first) with six observation taps (checked in the browser on stand-in data)
- [x] Observations feed the next card as new signals, with the visible walk (5.6.3); `upset` suppression; 90-day expiry
- [ ] Resident timeline, family weekly digest, family view and delete
- [x] Life-story PDF export (5.6.7) (text extracted and checked)

### Phase 4: Group sessions and compare
- [x] Room planner with maximin, upset veto and per-resident coverage (5.6.4)
- [x] Plain-AI comparison panel with the same rules (unit tested; live check pending the key)
- [x] Offline verifier `scripts/verify-card.mjs` in CI (5.6.6)

### Phase 5: Proof
- [x] `docs/SOURCES.md` with verified links
- [ ] Eval set: 15 curated, 15 wild forms (consent recorded)
- [ ] `scripts/eval.mjs` and `scripts/facts.mjs` write `docs/FACTS.json`; CI fails on mismatch
- [ ] Fault switch test; both error directions; misses listed in `EVIDENCE.md`
- [x] `PROOF.md` with commands to reproduce every number

### Phase 6: UI and quality
- [x] Landing page per Section 9 with hero SVG and image (hero SVG only, no image model available, logged in PROGRESS)
- [x] House-style test (fails on dashes, emoji, banned words; also filters model output)
- [ ] Playwright and axe on all five viewports, screenshots saved
- [x] `/judge`, `/method`, `/sample` complete; public lock and daily caps on live Qloo use

### Phase 7: Red team and submission
- [ ] Five judge-agent rounds (V5 Appendix B) on the deployed URL until clean; log in `REDTEAM_LOG.md`
- [x] README per Section 10 (generated regions read FACTS; screenshots follow the first live run)
- [x] `SUBMISSION_DEVPOST.md` mirroring the live form (confirm field names on the live form before pasting)
- [ ] Ask Kinnoski, then submit at least 2 hours before Oct 31, 4:45 am WAT
- [ ] Tag the commit, freeze the deployment

### Added from V5 revision 5.1 (the larger file; the first pass used the older copy)
- [x] `MOMENT.md`, `THESIS.md`, `RISK.md`, `PROOF_PLAN.md`, `PITCH.md` written (gates G2, G4, G6 and the live pitch)
- [ ] `DISCOVERY.md` run log: `node scripts/discovery.mjs` needs the Qloo key (document and delete test are written)
- [x] `SPONSOR_INTEL.md` has the sponsor's own words, availability and the shallow, deep and newest ladder
- [x] Pause and resume: session progress saved after every item and resumed (`backend/src/service.ts`)
- [x] Unattended run built: weekly family note on a Render cron job, create-only per resident and week
- [ ] One unattended run recorded in `EVIDENCE.md` (after the first Monday run on the deployed service)
- [x] `/trace` page, `/api/stats`, `/api/status` from real probes, kill switch and per-visitor and daily caps
- [x] `scripts/deploy-check.mjs` curls every public path after a deploy
- [x] Self-judging scores recorded in `PROGRESS.md` (comparison scores stay in `reference/`)
- [ ] Practitioner interview or founder stake recorded in `MOMENT.md` (none yet; none is claimed)
