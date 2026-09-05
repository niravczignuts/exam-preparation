-- KAN-46..49: the notification job runs every 15 minutes and must never send the
-- same reminder twice (e.g. a session-start ping firing on two consecutive runs).
-- Insert-the-log-row-first, as a claim, then send — a unique-constraint violation
-- means another run already claimed it, so skip sending rather than racing.
alter table notification_log add column if not exists dedupe_key text;

create unique index if not exists notification_log_user_dedupe_idx
  on notification_log (user_id, dedupe_key)
  where dedupe_key is not null;
