-- Doubt-solving chat assistant (OpenAI-powered, optional feature — see
-- backend/app/config.py's openai_api_key). Same owner-scoped pattern as
-- every other user-owned table in 0001_core_schema.sql.

create table if not exists doubt_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists doubt_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references doubt_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  for t in select unnest(array['doubt_threads', 'doubt_messages'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "owner_full_access" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
