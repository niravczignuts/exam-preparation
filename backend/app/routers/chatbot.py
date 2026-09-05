from __future__ import annotations

import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.chatbot import generate_checkin_closing, generate_checkin_opening
from app.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


def _recent_completion_rate(supabase, user_id: str) -> float:
    today = datetime.date.today().isoformat()
    rows = (
        supabase.table("daily_targets")
        .select("status")
        .eq("user_id", user_id)
        .lte("target_date", today)
        .order("target_date", desc=True)
        .limit(7)
        .execute()
        .data
        or []
    )
    if not rows:
        return 1.0  # no history yet — don't default to "struggling" tone on day one
    completed = sum(1 for r in rows if r["status"] == "completed")
    return completed / len(rows)


def _get_streak(supabase, user_id: str) -> dict:
    rows = supabase.table("streaks").select("*").eq("user_id", user_id).execute().data
    if rows:
        return rows[0]
    return {"user_id": user_id, "current_streak": 0, "longest_streak": 0, "last_active_date": None}


class StartCheckinRequest(BaseModel):
    daily_target_id: str
    language: str = "gu"


class CheckinResponse(BaseModel):
    checkin_id: str
    message: str


@router.post("/checkin/start", response_model=CheckinResponse)
async def start_checkin(
    body: StartCheckinRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> CheckinResponse:
    """KAN-39: begins the end-of-day check-in conversation for a given daily target."""
    target_rows = (
        supabase.table("daily_targets")
        .select("*")
        .eq("id", body.daily_target_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not target_rows:
        raise HTTPException(status_code=404, detail="Daily target not found")
    target = target_rows[0]

    streak = _get_streak(supabase, user_id)
    completion_rate = _recent_completion_rate(supabase, user_id)

    message = generate_checkin_opening(
        target_description=target["description"],
        current_streak=streak["current_streak"],
        recent_completion_rate=completion_rate,
        language=body.language,
    )

    checkin = (
        supabase.table("daily_checkins")
        .insert(
            {
                "user_id": user_id,
                "daily_target_id": body.daily_target_id,
                "checkin_date": target["target_date"],
                "transcript": [{"role": "assistant", "content": message}],
            }
        )
        .execute()
        .data[0]
    )
    return CheckinResponse(checkin_id=checkin["id"], message=message)


class FinishCheckinRequest(BaseModel):
    checkin_id: str
    status: str  # 'completed' | 'partially_completed' | 'missed'
    questions_solved: int
    recall_answers: str = ""
    language: str = "gu"


class FinishCheckinResponse(BaseModel):
    message: str
    current_streak: int
    longest_streak: int


@router.post("/checkin/finish", response_model=FinishCheckinResponse)
async def finish_checkin(
    body: FinishCheckinRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> FinishCheckinResponse:
    """KAN-39/40/41: records the user's structured reply, classifies the day, updates
    the streak, and generates a tone-adapted closing message (KAN-43/44)."""
    if body.status not in ("completed", "partially_completed", "missed"):
        raise HTTPException(status_code=422, detail="Invalid status")

    checkin_rows = (
        supabase.table("daily_checkins")
        .select("*")
        .eq("id", body.checkin_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not checkin_rows:
        raise HTTPException(status_code=404, detail="Check-in not found")
    checkin = checkin_rows[0]

    streak = _get_streak(supabase, user_id)
    completion_rate = _recent_completion_rate(supabase, user_id)

    closing = generate_checkin_closing(
        status=body.status,
        questions_solved=body.questions_solved,
        recall_answers=body.recall_answers,
        current_streak=streak["current_streak"],
        recent_completion_rate=completion_rate,
        language=body.language,
    )

    user_summary = (
        f"Status: {body.status}, questions solved: {body.questions_solved}. "
        f"Recall answers: {body.recall_answers or '(none)'}"
    )
    transcript = [*checkin["transcript"], {"role": "user", "content": user_summary}, {
        "role": "assistant",
        "content": closing,
    }]
    supabase.table("daily_checkins").update({"transcript": transcript}).eq(
        "id", body.checkin_id
    ).execute()

    supabase.table("daily_targets").update({"status": body.status}).eq(
        "id", checkin["daily_target_id"]
    ).execute()

    # KAN-41: increments on Completed (continuing a consecutive run, else restarts at
    # 1), resets to 0 on Missed, left unchanged on Partially Completed — the AC only
    # specifies those two rules explicitly.
    current = streak["current_streak"]
    longest = streak["longest_streak"]
    today = checkin["checkin_date"]
    yesterday = (datetime.date.fromisoformat(today) - datetime.timedelta(days=1)).isoformat()

    if body.status == "completed":
        current = current + 1 if streak.get("last_active_date") == yesterday else 1
        longest = max(longest, current)
        last_active_date = today
    elif body.status == "missed":
        current = 0
        last_active_date = streak.get("last_active_date")
    else:
        last_active_date = streak.get("last_active_date")

    supabase.table("streaks").upsert(
        {
            "user_id": user_id,
            "current_streak": current,
            "longest_streak": longest,
            "last_active_date": last_active_date,
        }
    ).execute()

    return FinishCheckinResponse(message=closing, current_streak=current, longest_streak=longest)
