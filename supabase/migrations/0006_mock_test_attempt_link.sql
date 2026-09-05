-- Links a question_attempts row to the specific mock test attempt it belongs to
-- (KAN-32/33 need a topic-wise/score breakdown per past mock test, not just a
-- global attempt history — practice-mode rows keep this null).
alter table question_attempts
  add column if not exists mock_test_attempt_id uuid references mock_test_attempts(id) on delete cascade;
