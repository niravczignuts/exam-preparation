-- Sprint 3: Syllabus management (KAN-18..22) + home countdown (KAN-50, KAN-51).

-- ---------------------------------------------------------------------------
-- Syllabus file uploads (KAN-19) — mirrors pyq_uploads' shape.
-- ---------------------------------------------------------------------------
create table if not exists syllabus_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table syllabus_uploads enable row level security;
create policy "owner_full_access" on syllabus_uploads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Links a generated syllabus tree back to the upload that produced it.
alter table subjects add column if not exists source_upload_id uuid
  references syllabus_uploads(id) on delete set null;

-- KAN-21 AC: status changes are timestamped.
alter table topics add column if not exists status_updated_at timestamptz not null default now();

-- KAN-50 AC: countdown needs hour/minute precision, not just a date.
alter table exam_stages add column if not exists exam_time time not null default '09:00:00';
