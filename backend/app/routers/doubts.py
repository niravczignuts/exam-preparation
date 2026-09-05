from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.doubt_assistant import generate_doubt_reply
from app.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/doubts", tags=["doubts"])

_HISTORY_LIMIT = 10


class AskDoubtRequest(BaseModel):
    thread_id: str | None = None
    topic_id: str | None = None
    message: str
    language: str = "gu"


class AskDoubtResponse(BaseModel):
    thread_id: str
    reply: str


@router.post("/ask", response_model=AskDoubtResponse)
async def ask_doubt(
    body: AskDoubtRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> AskDoubtResponse:
    """Doubt-solving chat assistant (OpenAI) — a student asks a study question and
    gets a tutor-style reply. This is an optional feature: the frontend only shows
    the control when `/health`'s openai_configured is true, so a 503 here means
    someone hit the endpoint directly without a key configured, not the normal
    path."""
    thread_id = body.thread_id
    if thread_id:
        thread_rows = (
            supabase.table("doubt_threads")
            .select("id")
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        if not thread_rows:
            raise HTTPException(status_code=404, detail="Doubt thread not found")
    else:
        title = body.message.strip()[:80] or "New doubt"
        thread = (
            supabase.table("doubt_threads")
            .insert({"user_id": user_id, "topic_id": body.topic_id, "title": title})
            .execute()
            .data[0]
        )
        thread_id = thread["id"]

    supabase.table("doubt_messages").insert(
        {"user_id": user_id, "thread_id": thread_id, "role": "user", "content": body.message}
    ).execute()

    history_rows = (
        supabase.table("doubt_messages")
        .select("role, content")
        .eq("thread_id", thread_id)
        .order("created_at", desc=True)
        .limit(_HISTORY_LIMIT)
        .execute()
        .data
        or []
    )
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(history_rows)]

    try:
        reply = generate_doubt_reply(history=history, language=body.language)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    supabase.table("doubt_messages").insert(
        {"user_id": user_id, "thread_id": thread_id, "role": "assistant", "content": reply}
    ).execute()

    return AskDoubtResponse(thread_id=thread_id, reply=reply)
