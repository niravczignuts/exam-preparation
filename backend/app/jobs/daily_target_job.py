"""Generates tomorrow's daily_targets row for every user who doesn't have one
yet, seeded from their timetable sessions for that day (KAN-73, KAN-8) plus
any unfinished topics carried forward from a Partially Completed or Missed
day (KAN-40).

Runs at 23:30 IST (see render.yaml's schedule) — i.e. near the end of
*today*, to propose *tomorrow's* target so it's ready before the user's next
study day starts. This must generate for tomorrow, not today: proposing
today's target minutes before today ends would be useless for planning.

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


def _build_target_description(sessions: list[dict], carry_forward: str | None) -> str:
    if not sessions:
        base = "No timetable sessions scheduled today — review your revision queue instead."
    else:
        parts = [f"{s['start_time']}-{s['end_time']}" for s in sessions]
        base = f"Complete {len(sessions)} scheduled session(s): {', '.join(parts)}"
    if carry_forward:
        return f"Catch up from yesterday: {carry_forward}\n\n{base}"
    return base


def _carry_forward_description(supabase, user_id: str, today: str) -> str | None:
    """KAN-40: a Partially Completed or Missed day's unfinished work carries into the
    next proposed target, instead of silently dropping it."""
    yesterday = (datetime.date.fromisoformat(today) - datetime.timedelta(days=1)).isoformat()
    resp = (
        supabase.table("daily_targets")
        .select("description, status")
        .eq("user_id", user_id)
        .eq("target_date", yesterday)
        .execute()
    )
    rows = resp.data or []
    if not rows or rows[0]["status"] not in ("partially_completed", "missed"):
        return None
    return rows[0]["description"]


def run() -> int:
    """Returns the count of users for whom a target generation failed."""
    supabase = get_supabase()
    target_date = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    failures = 0

    users_resp = supabase.table("settings").select("user_id").execute()
    user_ids = [row["user_id"] for row in users_resp.data or []]
    logger.info("daily_target_job: found %d user(s) to process for %s", len(user_ids), target_date)

    for user_id in user_ids:
        try:
            existing = (
                supabase.table("daily_targets")
                .select("id")
                .eq("user_id", user_id)
                .eq("target_date", target_date)
                .execute()
            )
            if existing.data:
                logger.info("user %s already has a target for %s, skipping", user_id, target_date)
                continue

            sessions_resp = (
                supabase.table("timetable_sessions")
                .select("start_time,end_time,timetables!inner(user_id)")
                .eq("timetables.user_id", user_id)
                .eq("session_date", target_date)
                .execute()
            )
            carry_forward = _carry_forward_description(supabase, user_id, target_date)
            description = _build_target_description(sessions_resp.data or [], carry_forward)

            supabase.table("daily_targets").insert(
                {
                    "user_id": user_id,
                    "target_date": target_date,
                    "description": description,
                    "status": "proposed",
                    "generated_by": "system",
                }
            ).execute()
            logger.info("user %s: created daily target for %s", user_id, target_date)
        except Exception:
            failures += 1
            logger.exception("daily_target_job failed for user %s", user_id)
            try:
                supabase.table("notification_log").insert(
                    {
                        "user_id": user_id,
                        "notification_type": "daily_target_job_failure",
                        "payload": {"target_date": target_date},
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
