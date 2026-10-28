# PROGRESS.md

Updated at the end of every working session.

## Standing rules (from Kinnoski, apply to every phase)
- All files and folders live inside `AFTERSONG/`.
- Nothing about other entries appears in committed code, UI, README or docs. Study material stays in `reference/` (gitignored). `scripts/check-clean.mjs` enforces this from `reference/blocked-terms.txt`, in the pre-commit hook.
- The word "fictional" never appears in the README, UI, voiceover or demo video. The disclosure that the persona and sample data are invented lives only in `EVIDENCE.md`. This replaces the "labelled fictional" wording in the build instruction. The "Sample" label on sample screens stays.
- Every commit is authored by 0xkinno. No AI attribution anywhere.
- House style: no dashes as punctuation, no emoji, no hype words.

## Session 1, 2026-10-28: Phase 0

### Done and verified
- Read `AFTERSONG_BUILD_INSTRUCTION.md` and `HACKATHON_WINNING_SYSTEM_V5.md` in full.
- Repo initialised on `main`. MIT licence. `.gitignore` covers `reference/`, `.env*`, and the two instruction files.
- Git identity set locally: `0xkinno`, `140649226+0xkinno@users.noreply.github.com` (numeric ID read from the public GitHub API).
- Attribution guards in place: `.github/workflows/no-claude-attribution.yml`, `.githooks/commit-msg`, `core.hooksPath=.githooks`. Added `.githooks/pre-commit` running `scripts/check-clean.mjs`.
- All 12 repos from Section 11 cloned into `reference/`. Notes in `reference/NOTES.md`. Lane map in `reference/LANE_MAP.md`.
- `RULES_EXTRACT.md` written from the live official rules page (read via the in-app browser).
- Name check for "Aftersong": no collision found, see `docs/NAME_CHECK.md`. App stores and trademark registers were not searched directly.
- Web app skeleton (`web/`, Next.js 15) with `/api/status`; backend skeleton (`backend/`, Node 22) with `/health` and `/status`; `render.yaml`. Built with `next build`, run locally, and `/api/status` returned the backend's measured status. Qloo shows `configured: false` because no key is set yet.
- `.env` created with a generated `BACKEND_SHARED_SECRET`. `.env.example` committed.

### Not done, needs Kinnoski
- **Vercel and Render deployment.** Requires logging in to those accounts, which I cannot do. Steps below. TASK.md keeps this item unchecked.
- **QLOO_API_KEY** and a model key in `.env`. Without the Qloo key the status probe reports "not configured", as designed.
- GitHub repo under 0xkinno: `gh` is not installed here, so the remote is not created.

### Deployment steps for Kinnoski
1. GitHub: create an empty public repo `0xkinno/aftersong`, then `git remote add origin <url>` and push `main`.
2. Render: New, Blueprint, pick the repo (it reads `render.yaml`). Set `QLOO_API_KEY` and `BACKEND_SHARED_SECRET` (same value as in `.env`).
3. Vercel: import the repo, set Root Directory to `web`, add `BACKEND_URL` (the Render URL), `BACKEND_SHARED_SECRET`.
4. Tell me both URLs. I will confirm `/api/status` shows a real backend probe and tick the last Phase 0 box.

### Notes
- Rules page says a video is not a listed submission item. Confirm on the live Devpost form in Phase 7.
- The brief's `filter.release_year` was not seen in any studied code. Phase 1 must probe it.
- Adjacent music-and-dementia products exist in the real world (details in `reference/LANE_MAP.md`). The pitch should acknowledge playlist apps fairly and show the year-window and carer-loop difference.

### Next
Phase 1 starts only after Kinnoski approves.
