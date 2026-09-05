-- pyq_uploads was missing the error_message column syllabus_uploads already has
-- (added by 0003_sprint3.sql), needed to surface why a parse failed (KAN-24/25,
-- mirrors syllabus upload's failure handling).
alter table pyq_uploads add column if not exists error_message text;
