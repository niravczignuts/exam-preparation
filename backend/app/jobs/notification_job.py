"""Sends every due push notification category (KAN-46..49) for users who have
a registered device token. Runs every 15 minutes via Render's cron schedule
(see render.yaml) so reminders fire even when nobody has the app open — a
server-side job, not a client-side timer, per KAN-49's reliability AC.

Each category is independently opt-out via Settings' notification_prefs
(KAN-49's override AC), and every send is deduped through notification_log's
(user_id, dedupe_key) unique index (migration 0007) — insert-the-log-row-
first as a claim, then send; a unique-constraint violation means another run
already claimed it. This matters because the job re-evaluates every
condition from scratch every 15 minutes, so nothing here is naturally
"already handled" without that claim.

Run manually: python -m app.jobs.notification_job
"""

from __future__ import annotations

import datetime
import logging
import random

from app.fcm import send_push
from app.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

# KAN-48 AC: message content must vary, not be the exact same string every time.
MOTIVATIONAL_INTERVAL_MESSAGES = [
    "Small steps every day add up to big results at exam time. Keep at it!",
    "Consistency beats intensity — even 20 focused minutes today counts.",
    "Your future self will thank you for the work you put in this week.",
    "One more topic covered is one less thing to worry about later.",
]
MOTIVATIONAL_MISSED_MESSAGES = [
    "Yesterday didn't go as planned — that's okay. Today's a clean slate.",
    "One missed day doesn't erase your progress. Let's get back to it today.",
    "Everyone has off days. What matters is showing up again today.",
]


def _now_ist() -> datetime.datetime:
    return datetime.datetime.now(IST)


def _in_quiet_hours(settings_row: dict, now: datetime.datetime) -> bool:
    start, end = settings_row.get("quiet_hours_start"), settings_row.get("quiet_hours_end")
    if not start or not end:
        return False
    now_t = now.time()
    start_t = datetime.time.fromisoformat(start)
    end_t = datetime.time.fromisoformat(end)
    if start_t <= end_t:
        return start_t <= now_t <= end_t
    return now_t >= start_t or now_t <= end_t  # window wraps past midnight


def _claim(supabase, user_id: str, notif_type: str, dedupe_key: str, payload: dict) -> bool:
    """True if this run won the claim (proceed to send); False if already sent."""
    try:
        supabase.table("notification_log").insert(
            {
                "user_id": user_id,
                "notification_type": notif_type,
                "dedupe_key": dedupe_key,
                "payload": payload,
                "status": "pending",
            }
        ).execute()
        return True
    except Exception:
        return False


def _mark(supabase, user_id: str, dedupe_key: str, status: str, error: str | None = None) -> None:
    update = {"status": status, "sent_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    if error:
        update["error_message"] = error
    supabase.table("notification_log").update(update).eq("user_id", user_id).eq(
        "dedupe_key", dedupe_key
    ).execute()


def _send(
    supabase, user_id: str, tokens: list[str], notif_type: str, dedupe_key: str, title: str, body: str, url: str
) -> None:
    if not _claim(supabase, user_id, notif_type, dedupe_key, {"url": url, "title": title, "body": body}):
        return
    sent_any = False
    last_error = None
    for token in tokens:
        try:
            send_push(token, title, body, {"url": url})
            sent_any = True
        except Exception as exc:
            last_error = str(exc)
            logger.exception("push failed for user %s / %s", user_id, notif_type)
    _mark(supabase, user_id, dedupe_key, "sent" if sent_any else "failed", None if sent_any else last_error)


def _check_timetable_sessions(supabase, user_id, tokens, today, now, prefs) -> None:
    resp = (
        supabase.table("timetable_sessions")
        .select("id,start_time,end_time,status,timetables!inner(user_id)")
        .eq("timetables.user_id", user_id)
        .eq("session_date", today)
        .eq("status", "scheduled")
        .execute()
    )
    for session in resp.data or []:
        start = datetime.datetime.combine(
            now.date(), datetime.time.fromisoformat(session["start_time"]), tzinfo=IST
        )
        minutes_until = (start - now).total_seconds() / 60

        if prefs.get("upcomingSlot", True) and 50 <= minutes_until <= 70:
            _send(
                supabase, user_id, tokens, "upcoming_slot", f"upcoming:{session['id']}",
                "Upcoming study session", f"Starts at {session['start_time'][:5]} — get ready.", "/timetable",
            )
        if prefs.get("studySessionStart", True) and -5 <= minutes_until <= 5:
            _send(
                supabase, user_id, tokens, "session_start", f"start:{session['id']}",
                "Study session starting", "Time to start your scheduled session.", "/timetable",
            )


def _check_pending_target(supabase, user_id, tokens, today, now, prefs) -> None:
    if not prefs.get("pendingTarget", True) or now.hour < 10:
        return
    rows = (
        supabase.table("daily_targets")
        .select("status")
        .eq("user_id", user_id)
        .eq("target_date", today)
        .execute()
        .data
        or []
    )
    if not rows or rows[0]["status"] != "proposed":
        return
    _send(
        supabase, user_id, tokens, "pending_target", f"pending-target:{today}",
        "Today's target is waiting", "You haven't accepted today's study target yet.", "/daily-target",
    )


def _check_eod_checkin(supabase, user_id, tokens, today, now, prefs) -> None:
    if not prefs.get("endOfDayCheckin", True) or now.hour < 20:
        return
    existing = (
        supabase.table("daily_checkins").select("id").eq("user_id", user_id).eq("checkin_date", today).execute().data
    )
    if existing:
        return
    _send(
        supabase, user_id, tokens, "eod_checkin", f"eod-checkin:{today}",
        "How did today go?", "Time for your end-of-day check-in.", "/daily-target",
    )


def _check_revision_due(supabase, user_id, tokens, today, now, prefs) -> None:
    if not prefs.get("revisionDue", True) or now.hour < 8:
        return
    rows = (
        supabase.table("revision_queue_items")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .lte("next_review_date", today)
        .execute()
        .data
        or []
    )
    if not rows:
        return
    _send(
        supabase, user_id, tokens, "revision_due", f"revision-due:{today}",
        "Revision items due", f"You have {len(rows)} question(s) due for revision today.", "/revision",
    )


def _check_mock_test_due(supabase, user_id, tokens, today, now, prefs) -> None:
    if not prefs.get("mockTestDue", True):
        return
    week_key = now.strftime("%G-W%V")
    week_start = (now.date() - datetime.timedelta(days=7)).isoformat()
    recent = (
        supabase.table("mock_test_attempts")
        .select("id")
        .eq("user_id", user_id)
        .gte("started_at", week_start)
        .execute()
        .data
    )
    if recent:
        return
    _send(
        supabase, user_id, tokens, "mock_test_due", f"mock-test-due:{week_key}",
        "Mock test due", "It's been a week — try a full mock test to check your progress.", "/mock-test",
    )


def _check_motivational(supabase, user_id, tokens, today, now, prefs) -> None:
    if not prefs.get("motivational", True):
        return

    yesterday = (now.date() - datetime.timedelta(days=1)).isoformat()
    yesterday_rows = (
        supabase.table("daily_targets")
        .select("status")
        .eq("user_id", user_id)
        .eq("target_date", yesterday)
        .execute()
        .data
    )
    if yesterday_rows and yesterday_rows[0]["status"] == "missed":
        _send(
            supabase, user_id, tokens, "motivational", f"motivational-missed:{today}",
            "Keep going", random.choice(MOTIVATIONAL_MISSED_MESSAGES), "/daily-target",
        )
        return  # the interval nudge can wait — don't double up in one day

    week_key = now.strftime("%G-W%V")
    _send(
        supabase, user_id, tokens, "motivational", f"motivational-interval:{week_key}",
        "A little motivation", random.choice(MOTIVATIONAL_INTERVAL_MESSAGES), "/",
    )


def run() -> int:
    """Returns the count of users for whom notification processing failed."""
    supabase = get_supabase()
    now = _now_ist()
    today = now.date().isoformat()
    failures = 0

    settings_rows = supabase.table("settings").select("*").execute().data or []
    logger.info("notification_job: processing %d user(s)", len(settings_rows))

    for settings_row in settings_rows:
        user_id = settings_row["user_id"]
        try:
            tokens = [
                r["fcm_token"]
                for r in (supabase.table("device_tokens").select("fcm_token").eq("user_id", user_id).execute().data or [])
            ]
            if not tokens or _in_quiet_hours(settings_row, now):
                continue

            prefs = settings_row.get("notification_prefs") or {}
            _check_timetable_sessions(supabase, user_id, tokens, today, now, prefs)
            _check_pending_target(supabase, user_id, tokens, today, now, prefs)
            _check_eod_checkin(supabase, user_id, tokens, today, now, prefs)
            _check_revision_due(supabase, user_id, tokens, today, now, prefs)
            _check_mock_test_due(supabase, user_id, tokens, today, now, prefs)
            _check_motivational(supabase, user_id, tokens, today, now, prefs)
        except Exception:
            failures += 1
            logger.exception("notification_job failed for user %s", user_id)

    logger.info("notification_job: done, %d failure(s)", failures)
    return failures


if __name__ == "__main__":
    import sys

    sys.exit(1 if run() > 0 else 0)
