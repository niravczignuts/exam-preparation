"""Generates today's daily_targets row for every user who doesn't have one
yet, seeded from their timetable sessions for today (KAN-73, KAN-8).

Run on a schedule by the backend host's cron mechanism:
    python -m app.jobs.daily_target_job
Render's blueprint (render.yaml) wires this up as a separate cron service so
it runs independent of whether anyone has the app open, satisfying the
KAN-73 acceptance criteria (real job, runs on schedule, failures observable).
"""

import datetime
import logging
import sys

from app.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _build_target_description(sessions: list[dict]) -> str:
    if not sessions:
        return "No timetable sessions scheduled today — review your revision queue instead."
    parts = [f"{s['start_time']}-{s['end_time']}" for s in sessions]
    return f"Complete {len(sessions)} scheduled session(s): {', '.join(parts)}"


def run() -> int:
    """Returns the count of users for whom a target generation failed."""
    supabase = get_supabase()
    today = datetime.date.today().isoformat()
    failures = 0

    users_resp = supabase.table("settings").select("user_id").execute()
    user_ids = [row["user_id"] for row in users_resp.data or []]
    logger.info("daily_target_job: found %d user(s) to process for %s", len(user_ids), today)

    for user_id in user_ids:
        try:
            existing = (
                supabase.table("daily_targets")
                .select("id")
                .eq("user_id", user_id)
                .eq("target_date", today)
                .execute()
            )
            if existing.data:
                logger.info("user %s already has a target for %s, skipping", user_id, today)
                continue

            sessions_resp = (
                supabase.table("timetable_sessions")
                .select("start_time,end_time,timetables!inner(user_id)")
                .eq("timetables.user_id", user_id)
                .eq("session_date", today)
                .execute()
            )
            description = _build_target_description(sessions_resp.data or [])

            supabase.table("daily_targets").insert(
                {
                    "user_id": user_id,
                    "target_date": today,
                    "description": description,
                    "status": "proposed",
                    "generated_by": "system",
                }
            ).execute()
            logger.info("user %s: created daily target for %s", user_id, today)
        except Exception:
            failures += 1
            logger.exception("daily_target_job failed for user %s", user_id)
            try:
                supabase.table("notification_log").insert(
                    {
                        "user_id": user_id,
                        "notification_type": "daily_target_job_failure",
                        "payload": {"target_date": today},
                        "status": "failed",
                        "error_message": "See job logs for traceback",
                    }
                ).execute()
            except Exception:
                logger.exception("also failed to record the failure in notification_log")

    logger.info("daily_target_job: done, %d failure(s)", failures)
    return failures


if __name__ == "__main__":
    sys.exit(1 if run() > 0 else 0)
