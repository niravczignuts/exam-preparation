-- Data reset/clear option (KAN-62).
--
-- security definer so it can delete across every user-owned table in one
-- atomic call without needing a lookup query per table first, but every
-- statement is still scoped to `where user_id = auth.uid()` (or, for
-- child tables with no user_id column, scoped via a subquery back to the
-- owning row's user_id) so it can never touch another user's rows even
-- though it runs with elevated privilege.
create or replace function reset_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from mock_test_questions
    where mock_test_id in (select id from mock_tests where user_id = auth.uid());
  delete from timetable_sessions
    where timetable_id in (select id from timetables where user_id = auth.uid());
  delete from topics
    where subject_id in (select id from subjects where user_id = auth.uid());

  delete from settings where user_id = auth.uid();
  delete from exam_stages where user_id = auth.uid();
  delete from subjects where user_id = auth.uid();
  delete from pyq_uploads where user_id = auth.uid();
  delete from questions where user_id = auth.uid();
  delete from question_attempts where user_id = auth.uid();
  delete from mock_tests where user_id = auth.uid();
  delete from mock_test_attempts where user_id = auth.uid();
  delete from timetables where user_id = auth.uid();
  delete from daily_targets where user_id = auth.uid();
  delete from daily_checkins where user_id = auth.uid();
  delete from streaks where user_id = auth.uid();
  delete from revision_queue_items where user_id = auth.uid();
  delete from device_tokens where user_id = auth.uid();
  delete from notification_log where user_id = auth.uid();
end;
$$;

grant execute on function reset_user_data() to authenticated;
