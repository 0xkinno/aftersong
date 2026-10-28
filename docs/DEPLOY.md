# Deploy

Three services. Do them in this order. Nothing here needs a code change.

## 1. Supabase (storage and carer sign-in)
1. Create a project. In SQL editor run `supabase/schema.sql`.
2. Authentication, URL configuration: set Site URL to the Vercel address and add it to Redirect URLs.
3. Copy: project URL, anon key, service role key.

## 2. Render (backend, holds the Qloo key)
1. New, Blueprint, pick the GitHub repo. It reads `render.yaml` (Node 22.19, root `backend`).
2. Set `QLOO_API_KEY`, `BACKEND_SHARED_SECRET` (a long random value), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MODEL_PROVIDER`, `MODEL_ID` and one model key.
3. Optional: `PER_VISITOR_PER_DAY`, `PUBLIC_BUILDS_PER_DAY`, `DAILY_QLOO_CAP`, `KILL_SWITCH=on` to stop public live builds at once.
4. A cron job in `render.yaml` calls `/internal/digests` every Monday at 07:00 UTC for the weekly family note.
5. Check: `<backend>/health` returns `up: true`.

## 3. Vercel (web)
1. Import the repo. Root Directory `web`. Framework Next.js.
2. Environment variables: `BACKEND_URL` (the Render address), `BACKEND_SHARED_SECRET` (same value), `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
3. Deploy, then run `node scripts/deploy-check.mjs <web-url> <backend-url>`. It requests every public path.

## After the first deploy
- Open `/api/status`. Qloo and the model show the result of a real probe, with times.
- Open `/sample` and build Walter's card once, so the saved sample exists. Then `/trace` shows it.
- Put the two URLs in `docs/deploy.json` and run `node scripts/readme.mjs`.

## Never
- Put the Qloo key in the web project, in a `NEXT_PUBLIC_` variable, or in the repository.
- Deploy over a URL that belongs to a submitted entry from another event.
