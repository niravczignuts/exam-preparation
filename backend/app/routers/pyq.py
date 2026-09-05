from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.embeddings import embed_and_dedup, embed_text
from app.language import guard_language
from app.parsing import Question, structure_pyq_paper
from app.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pyq", tags=["pyq"])


class UploadResult(BaseModel):
    upload_id: str
    file_name: str
    parse_status: str
    question_count: int
    error: str | None = None
    # Always 0 when OPENAI_API_KEY isn't configured — embedding/dedup is a
    # best-effort add-on to parsing, never required for an upload to succeed.
    duplicate_count: int = 0


class UploadBatchResponse(BaseModel):
    results: list[UploadResult]


class QuestionSearchResult(BaseModel):
    id: str
    question_text: str
    topic_id: str | None
    exam_year: int | None
    similarity: float


class QuestionSearchResponse(BaseModel):
    results: list[QuestionSearchResult]


def _load_catalog(supabase, user_id: str) -> list[dict]:
    """Subjects + topics for auto-tagging guesses (KAN-26) — see structure_pyq_paper."""
    rows = (
        supabase.table("subjects")
        .select("name, topics(name)")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    return rows or []


def _resolve_tag(supabase, user_id: str, question: Question) -> str | None:
    """Resolves a question's guessed subject/topic names back to a real topic_id.

    Guesses are names, not ids (the model never sees real ids), so this re-queries by
    name — untrusted/stale guesses (a renamed or deleted topic) simply fail to match and
    the question is left untagged for manual re-tagging rather than erroring the upload.
    """
    if not question.topic_guess or not question.subject_guess:
        return None
    rows = (
        supabase.table("topics")
        .select("id, name, subjects!inner(user_id, name)")
        .eq("name", question.topic_guess)
        .eq("subjects.user_id", user_id)
        .eq("subjects.name", question.subject_guess)
        .execute()
        .data
    )
    return rows[0]["id"] if rows else None


@router.post("/uploads", response_model=UploadBatchResponse)
async def upload_pyq_papers(
    files: list[UploadFile] = File(...),
    exam_year: int | None = Form(None),
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> UploadBatchResponse:
    """Uploads one or more PYQ papers, storing and auto-parsing each into questions
    added directly to the Q&A bank (KAN-23, KAN-24, KAN-25, KAN-26). A failure on one
    file doesn't stop the rest of the batch — each result reports its own status."""
    catalog = _load_catalog(supabase, user_id)
    results: list[UploadResult] = []

    for file in files:
        file_bytes = await file.read()
        storage_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
        upload_row = (
            supabase.table("pyq_uploads")
            .insert(
                {
                    "user_id": user_id,
                    "file_name": file.filename,
                    "storage_path": storage_path,
                    "exam_year": exam_year,
                    "parse_status": "processing",
                }
            )
            .execute()
            .data[0]
        )
        upload_id = upload_row["id"]

        try:
            supabase.storage.from_("pyq-uploads").upload(
                storage_path,
                file_bytes,
                {"content-type": file.content_type or "application/octet-stream"},
            )
            paper = structure_pyq_paper(
                file_bytes, file.content_type or "", file.filename or "", catalog
            )
            if paper.language:
                supabase.table("pyq_uploads").update({"language": paper.language}).eq(
                    "id", upload_id
                ).execute()
        except Exception as exc:
            logger.exception("PYQ parse failed for upload %s", upload_id)
            supabase.table("pyq_uploads").update(
                {"parse_status": "failed", "error_message": str(exc)}
            ).eq("id", upload_id).execute()
            results.append(
                UploadResult(
                    upload_id=upload_id,
                    file_name=file.filename or "",
                    parse_status="failed",
                    question_count=0,
                    error=str(exc),
                )
            )
            continue

        question_count = 0
        duplicate_count = 0
        for question in paper.questions:
            topic_id = _resolve_tag(supabase, user_id, question)
            embedding, duplicate_of = embed_and_dedup(supabase, user_id, topic_id, question.question_text)
            payload = {
                "user_id": user_id,
                "topic_id": topic_id,
                "pyq_upload_id": upload_id,
                "question_text": question.question_text,
                "options": question.options,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "exam_year": exam_year,
                "language": guard_language(question.language, question.question_text),
            }
            if embedding is not None:
                payload["embedding"] = embedding
            if duplicate_of is not None:
                payload["duplicate_of"] = duplicate_of
                duplicate_count += 1
            supabase.table("questions").insert(payload).execute()
            question_count += 1

        supabase.table("pyq_uploads").update({"parse_status": "completed"}).eq(
            "id", upload_id
        ).execute()
        results.append(
            UploadResult(
                upload_id=upload_id,
                file_name=file.filename or "",
                parse_status="completed",
                question_count=question_count,
                duplicate_count=duplicate_count,
            )
        )

    return UploadBatchResponse(results=results)


@router.get("/questions/search", response_model=QuestionSearchResponse)
async def search_questions(
    q: str,
    topic_id: str | None = None,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> QuestionSearchResponse:
    """Semantic ("search by meaning") search over the Q&A bank. Goes through the
    backend rather than direct-to-Supabase (unlike the rest of QuestionBank's
    reads) because generating the query embedding needs the OpenAI key. Optional
    feature — the frontend only shows the search box when /health's
    openai_configured is true; a 503 here means it was hit directly without a key
    configured."""
    try:
        query_embedding = embed_text(q)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    rows = (
        supabase.rpc(
            "match_questions",
            {
                "query_embedding": query_embedding,
                "match_user_id": user_id,
                "match_topic_id": topic_id,
                "match_threshold": 0.5,
                "match_count": 20,
            },
        )
        .execute()
        .data
        or []
    )
    return QuestionSearchResponse(results=[QuestionSearchResult(**row) for row in rows])
