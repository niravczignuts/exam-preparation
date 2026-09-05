-- Core schema for the Exam Prep App.
-- Every user-owned table carries user_id referencing auth.users, with RLS
-- restricting rows to their owner (Supabase's standard multi-tenant pattern).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Settings (KAN-14)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'gu' check (language in ('gu', 'en')),
  quiet_hours_start time,
  quiet_hours_end time,
  notification_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Multiple exam stages per user (KAN-11, KAN-59), e.g. Prelim / Mains.
create table if not exists exam_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exam_date date not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Syllabus (KAN-4)
-- ---------------------------------------------------------------------------
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  parent_topic_id uuid references topics(id) on delete cascade,
  name text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'revision_needed')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PYQ upload & Q&A bank (KAN-5)
-- ---------------------------------------------------------------------------
create table if not exists pyq_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  exam_year int,
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  pyq_upload_id uuid references pyq_uploads(id) on delete set null,
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  exam_year int,
  created_at timestamptz not null default now()
);

create table if not exists question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_answer text,
  is_correct boolean,
  was_skipped boolean not null default false,
  source text not null default 'practice' check (source in ('practice', 'mock_test')),
  attempted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mock tests (KAN-6)
-- ---------------------------------------------------------------------------
create table if not exists mock_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  pattern_reference text,
  duration_minutes int not null default 90,
  created_at timestamptz not null default now()
);

create table if not exists mock_test_questions (
  mock_test_id uuid not null references mock_tests(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  sort_order int not null default 0,
  primary key (mock_test_id, question_id)
);

create table if not exists mock_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mock_test_id uuid not null references mock_tests(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  correct_count int,
  incorrect_count int,
  skipped_count int
);

-- ---------------------------------------------------------------------------
-- Timetable (KAN-7)
-- ---------------------------------------------------------------------------
create table if not exists timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Timetable',
  is_auto_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists timetable_sessions (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references timetables(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'missed', 'rescheduled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Daily target engine + chatbot check-ins (KAN-8, KAN-9)
-- ---------------------------------------------------------------------------
create table if not exists daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  description text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'completed', 'partially_completed', 'missed')),
  generated_by text not null default 'system' check (generated_by in ('system', 'user')),
  created_at timestamptz not null default now(),
  unique (user_id, target_date)
);

create table if not exists daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_target_id uuid references daily_targets(id) on delete set null,
  checkin_date date not null,
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create table if not exists streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Revision queue / spaced repetition (KAN-13)
-- ---------------------------------------------------------------------------
create table if not exists revision_queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  added_reason text not null check (added_reason in ('wrong', 'skipped')),
  interval_stage int not null default 1 check (interval_stage in (1, 3, 7)),
  next_review_date date not null,
  status text not null default 'pending' check (status in ('pending', 'cleared')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications (KAN-10)
-- ---------------------------------------------------------------------------
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: every user-owned table is readable/writable only by
-- its own user_id (backend uses the service-role key and bypasses RLS for
-- scheduled jobs; the frontend/anon-key path is restricted to this policy).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'settings', 'exam_stages', 'subjects', 'pyq_uploads', 'questions',
      'question_attempts', 'mock_tests', 'mock_test_attempts', 'timetables',
      'daily_targets', 'daily_checkins', 'streaks',
      'revision_queue_items', 'device_tokens', 'notification_log'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "owner_full_access" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- Tables with no direct user_id column are scoped via their parent's owner.
alter table mock_test_questions enable row level security;
create policy "owner_full_access" on mock_test_questions for all
  using (exists (
    select 1 from mock_tests mt where mt.id = mock_test_questions.mock_test_id and mt.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from mock_tests mt where mt.id = mock_test_questions.mock_test_id and mt.user_id = auth.uid()
  ));

alter table topics enable row level security;
create policy "owner_full_access" on topics for all
  using (exists (
    select 1 from subjects s where s.id = topics.subject_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from subjects s where s.id = topics.subject_id and s.user_id = auth.uid()
  ));

alter table timetable_sessions enable row level security;
create policy "owner_full_access" on timetable_sessions for all
  using (exists (
    select 1 from timetables tt where tt.id = timetable_sessions.timetable_id and tt.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from timetables tt where tt.id = timetable_sessions.timetable_id and tt.user_id = auth.uid()
  ));
