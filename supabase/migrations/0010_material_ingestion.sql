-- Web-search-driven material ingestion (language tracking + source
-- attribution) and a server-side weak-topics helper for the goal-coaching
-- check-in message.

alter table syllabus_uploads add column if not exists language text;
alter table syllabus_uploads add column if not exists source_url text;

alter table pyq_uploads add column if not exists language text;
alter table pyq_uploads add column if not exists source_url text;

-- Nullable, no backfill: NULL means "unknown," never assume a pre-existing
-- row is English (that would poison future language-matching logic, e.g. the
-- doubt assistant replying in the wrong language for an old question).
alter table questions add column if not exists language text;

-- Single source of truth for "weak topics" — mirrors
-- frontend/src/dashboard/useDashboardData.ts's useWeakTopics exactly (same
-- min-attempts/accuracy-threshold/sort), so the goal-coaching check-in
-- (backend/app/routers/chatbot.py) doesn't reimplement that query and drift
-- from it. The frontend keeps its existing client-side computation
-- unchanged for now — this is additive, not a replacement.
create or replace function weak_topics_for_user(
  p_user_id uuid,
  p_min_attempts int default 3,
  p_threshold float default 0.6,
  p_limit int default 3
)
returns table (topic_id uuid, topic_name text, subject_name text, accuracy float, total int)
language sql stable
as $$
  select
    t.id as topic_id,
    t.name as topic_name,
    s.name as subject_name,
    (count(*) filter (where qa.is_correct))::float / count(*) as accuracy,
    count(*)::int as total
  from question_attempts qa
  join questions q on q.id = qa.question_id
  join topics t on t.id = q.topic_id
  join subjects s on s.id = t.subject_id
  where qa.user_id = p_user_id
    and qa.was_skipped = false
    and q.topic_id is not null
  group by t.id, t.name, s.name
  having count(*) >= p_min_attempts
     and (count(*) filter (where qa.is_correct))::float / count(*) < p_threshold
  order by accuracy asc
  limit p_limit;
$$;
