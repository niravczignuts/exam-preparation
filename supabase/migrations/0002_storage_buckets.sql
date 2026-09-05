-- Storage buckets for uploaded syllabus documents and PYQ papers (KAN-69).
-- Private buckets: access is via signed URLs issued by the backend, not
-- public reads.

insert into storage.buckets (id, name, public)
values
  ('syllabus-uploads', 'syllabus-uploads', false),
  ('pyq-uploads', 'pyq-uploads', false)
on conflict (id) do nothing;

-- Users may only manage files under a path prefixed with their own uid,
-- e.g. `${auth.uid()}/2023-paper.pdf`.
create policy "owner_read_syllabus_uploads" on storage.objects for select
  using (bucket_id = 'syllabus-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner_write_syllabus_uploads" on storage.objects for insert
  with check (bucket_id = 'syllabus-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner_read_pyq_uploads" on storage.objects for select
  using (bucket_id = 'pyq-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner_write_pyq_uploads" on storage.objects for insert
  with check (bucket_id = 'pyq-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
