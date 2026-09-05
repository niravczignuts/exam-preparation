# Supabase

Schema and storage setup for the Exam Prep App, version-controlled as SQL migrations in `migrations/`.

## One-time project setup (manual — needs your Supabase account)

1. Create a project at https://supabase.com/dashboard (free tier is enough to start).
2. Install the CLI and log in:
   ```
   npm install -g supabase
   supabase login
   ```
3. Link this repo to the project (run from the repo root):
   ```
   supabase link --project-ref <your-project-ref>
   ```
   `<your-project-ref>` is in the project's dashboard URL: `supabase.com/dashboard/project/<project-ref>`.
4. Apply the migrations:
   ```
   supabase db push
   ```
5. Collect the values the backend and frontend need (Project Settings → API):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — backend only, never expose to the frontend (bypasses RLS, used by scheduled jobs).
   - `SUPABASE_ANON_KEY` — safe for the frontend, respects RLS.

## What's in the schema

- **Syllabus**: `subjects`, `topics` (self-referencing for sub-topics, tracks completion status).
- **PYQ / Q&A bank**: `pyq_uploads`, `questions`, `question_attempts`.
- **Mock tests**: `mock_tests`, `mock_test_questions`, `mock_test_attempts`.
- **Timetable**: `timetables`, `timetable_sessions`.
- **Daily target engine + chatbot**: `daily_targets`, `daily_checkins`, `streaks`.
- **Revision queue**: `revision_queue_items` (spaced-repetition intervals: 1/3/7 days).
- **Notifications**: `device_tokens` (FCM tokens), `notification_log`.
- **Settings**: `settings`, `exam_stages` (supports multiple simultaneous exam-stage countdowns).

Every user-owned table has Row Level Security enabled, scoped to `auth.uid() = user_id`. The backend uses the service-role key (bypasses RLS) for scheduled jobs and admin-style writes; the frontend should use the anon key + Supabase Auth session so RLS applies per-user.

Two private Storage buckets — `syllabus-uploads` and `pyq-uploads` — hold uploaded files under a `${user_id}/...` path prefix, matching the storage policies in `0002_storage_buckets.sql`.

## Adding a new migration

```
supabase migration new <description>
```
Edit the generated file under `migrations/`, then `supabase db push` to apply it to the linked project. Never edit an already-applied migration file — add a new one instead.
