# Setup Guide (Sprint 1 foundation)

This repo is a monorepo: `frontend/` (React PWA, deployed to Netlify), `backend/` (Python FastAPI, deployed to Render), `supabase/` (Postgres schema + storage). The code/config for all of Sprint 1 is committed; the steps below are the parts that need *your* accounts and browser login — nobody can do these except whoever owns the Supabase/Netlify/Render/Firebase accounts.

## 1. GitHub (KAN-68) — done

The repo already has an `origin` remote, branch/PR conventions are in `CONTRIBUTING.md`, the PR template is in `.github/PULL_REQUEST_TEMPLATE.md`, and CI runs on every PR via `.github/workflows/ci.yml`. Nothing manual needed here beyond normal day-to-day PR review.

## 2. Supabase (KAN-69)

Full instructions: `supabase/README.md`. Short version:
1. Create a project at supabase.com/dashboard.
2. `npm install -g supabase && supabase login`
3. `supabase link --project-ref <your-project-ref>`
4. `supabase db push` — applies every migration under `supabase/migrations/`, including `0003_sprint3.sql` (syllabus uploads + the exam-countdown time column).
5. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API — you'll need them in step 4 below.

## 3. Backend on Render (KAN-70, KAN-73)

The repo has `render.yaml` (a Render "Blueprint") defining two services: the API (`exam-prep-api`, a Docker web service) and a cron job (`exam-prep-daily-target-job`, runs daily at 18:00 UTC).

1. Go to render.com → New → Blueprint → connect this GitHub repo. Render reads `render.yaml` and proposes both services.
2. For `exam-prep-api`, set the environment variables it asks for (marked `sync: false` in render.yaml, so Render will prompt): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Upload the Firebase service account JSON (see step 5) as a **Secret File** at `/etc/secrets/firebase-service-account.json` — this matches `FIREBASE_SERVICE_ACCOUNT_PATH` in `render.yaml`.
4. Deploy. Once live, verify `https://<your-service>.onrender.com/health` returns `{"status": "ok", ...}`.
5. Set the same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` on the `exam-prep-daily-target-job` cron service.
6. Edit `netlify.toml`'s `/api/*` redirect target to your real Render URL (Netlify doesn't support env-var interpolation in redirects, so this is a one-line manual edit, not an env var).

**Why Render, not Netlify Functions**: Netlify's serverless functions are short-lived, request/response only — they can't run the always-on FastAPI process or the daily cron job KAN-73 needs (a function has no "sit and wait for 6pm" capability). Render's free web service stays up and its Cron Job service type runs on a real schedule against the same Docker image, so both KAN-70 and KAN-73 are satisfied by one host.

## 4. Frontend on Netlify (KAN-71)

1. netlify.com → Add new site → Import an existing project → pick this repo. Netlify reads `netlify.toml` (base `frontend/`, build `npm run build`, publish `frontend/dist`) automatically.
2. Add the frontend env vars (Site configuration → Environment variables) from `frontend/.env.example` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FIREBASE_*`, `VITE_API_BASE_URL` (leave as `/api` in production so it goes through the Netlify redirect to Render).
3. Deploy. Every push to `main` auto-deploys; every PR gets its own deploy preview automatically — no extra config needed for that part, it's a default Netlify GitHub-integration behavior.

## 5. Firebase / FCM (KAN-72)

Per this ticket's own acceptance criteria, the Firebase project itself is the product owner's responsibility to create (not engineering's) — but the app code side is in place:

1. Create a project at console.firebase.google.com (or reuse an existing one).
2. Project Settings → General → Add app → Web app. Copy the config values into `frontend/.env` (see `frontend/.env.example`) **and** paste the same values into `frontend/public/firebase-messaging-sw.js` (service workers can't read Vite env vars, so they're duplicated there — not secret, just public web config).
3. Project Settings → Cloud Messaging → Web Push certificates → generate a key pair → that's `VITE_FIREBASE_VAPID_KEY`.
4. Project Settings → Service Accounts → Generate new private key → this JSON file is a real secret. Never commit it (it's gitignored). Use it locally as `backend/.env`'s `FIREBASE_SERVICE_ACCOUNT_PATH`, and upload it to Render as a Secret File (step 3 above) in production.
5. **End-to-end test** (this is the one piece of KAN-72's acceptance criteria nobody but you can complete, since it needs a live Firebase project + a real browser): once both frontend and backend are deployed, open the deployed site, grant notification permission, and confirm a registration token appears (wire that up to a `device_tokens` insert — not yet built, this is scaffolding only). Then call `app.fcm.send_push(token, "Test", "Hello")` from a Python shell against the deployed backend and confirm the browser receives it.

## 6. Supabase Auth (Sprint 3)

The syllabus features (KAN-18..22) require a real signed-in user — every table's RLS policy checks `auth.uid()`.

1. Supabase Dashboard → Authentication → Providers → make sure **Email** is enabled (it is by default).
2. For local/dev testing, Authentication → Settings → turn off "Confirm email" so `supabase.auth.signUp()` returns an active session immediately instead of requiring an email link (leave it on in production).
3. Copy the **JWT Secret** from Project Settings → API → JWT Settings into `backend/.env`'s `SUPABASE_JWT_SECRET` (and as a Render env var in production) — the backend uses it to verify the token the frontend sends on `POST /syllabus/uploads`.
4. Get an API key from console.anthropic.com and set `backend/.env`'s `ANTHROPIC_API_KEY` (and the Render env var) — used to auto-structure uploaded syllabus files (KAN-19).

## What's genuinely done vs. what needs you

| Ticket | Code/config done | Needs your manual action |
|---|---|---|
| KAN-68 | Yes, fully | — |
| KAN-69 | Migrations written | Create the Supabase project, link, push |
| KAN-70 | Dockerfile, health endpoint, render.yaml | Create the Render account/blueprint deploy |
| KAN-71 | Frontend scaffold + netlify.toml | Create the Netlify site, link repo |
| KAN-72 | Client + backend FCM integration code | Create the Firebase project, get credentials, run the live test |
| KAN-73 | Job script + Render cron definition | Deploy so it actually runs on schedule |
| KAN-18..22 | Syllabus CRUD, upload/parse endpoint, completion tracking | Enable Supabase Auth email provider, set `SUPABASE_JWT_SECRET` + `ANTHROPIC_API_KEY` |
| KAN-50, KAN-51 | Countdown UI, multi-stage support | — |
