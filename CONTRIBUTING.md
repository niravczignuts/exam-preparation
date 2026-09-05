# Contributing

## Branching model

- `main` is always deployable — Netlify (frontend) and Render (backend) both deploy from it.
- Every change goes through a feature branch, never a direct commit to `main`:
  ```
  git checkout -b <type>/<short-description>
  # e.g. feat/syllabus-upload, fix/timetable-timezone, chore/ci-cache
  ```
  `<type>` is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Open a pull request into `main` when the branch is ready. Netlify generates a deploy preview per PR automatically once the site is linked (see `docs/SETUP.md`).
- Squash-merge PRs so `main` history stays one commit per change.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat: add syllabus upload endpoint`, `fix: correct timetable auto-suggest off-by-one`.

## Pull requests

- Fill out `.github/PULL_REQUEST_TEMPLATE.md` — it's applied automatically.
- CI (`.github/workflows/ci.yml`) must pass: frontend lint+build, backend lint+test.
- Reference the Jira ticket key in the PR title or description (e.g. `KAN-23`) so work traces back to the backlog.

## Project layout

```
frontend/   React + Vite PWA (deployed to Netlify)
backend/    Python FastAPI service (deployed to Render)
supabase/   Postgres schema migrations + storage bucket setup
docs/       Setup guides and research docs
```

See `docs/SETUP.md` for how to get every service (Supabase, Netlify, Render, Firebase) running locally and in the cloud.
