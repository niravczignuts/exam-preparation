# Exam Prep App

A study companion for the GSET Commerce exam — syllabus tracking, PYQ-driven practice, mock tests, an auto-generated daily timetable, a Gujarati motivational chatbot, and push-notification reminders. The GPSC app and similar tools were studied for feature parity (see `docs/research/gpsc-benchmarking.md`).

## Structure

```
frontend/   React + Vite PWA, deployed to Netlify
backend/    Python FastAPI service + scheduled jobs, deployed to Render
supabase/   Postgres schema migrations + storage bucket config
docs/       Setup guide, research, branching conventions
```

## Getting started

- First-time cloud setup (Supabase/Render/Netlify/Firebase accounts): `docs/SETUP.md`.
- Local frontend dev: `cd frontend && cp .env.example .env && npm install && npm run dev`.
- Local backend dev: `cd backend && cp .env.example .env && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload`.
- Branching/PR conventions: `CONTRIBUTING.md`.

Backlog and sprint plan are tracked in Jira, project **KAN** ("Exam Preparation").
