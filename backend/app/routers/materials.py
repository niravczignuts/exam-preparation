from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.embeddings import embed_and_dedup
from app.language import guard_language
from app.parsing import structure_pyq_paper, structure_syllabus
from app.routers.pyq import _load_catalog, _resolve_tag
from app.routers.syllabus import _insert_tree
from app.supabase_client import get_supabase
from app.web_ingest import extract_readable_text, fetch_document
from app.web_search import find_material_urls

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/materials", tags=["materials"])

_MAX_SOURCES = 5


class SearchAndIngestRequest(BaseModel):
    query: str
    kind: str  # "syllabus" | "pyq"
    exam_year: int | None = None


class SearchAndIngestResponse(BaseModel):
    sources_tried: int
    sources_ingested: int = 0
    sources_failed: int = 0
    questions_added: int = 0
    duplicates_flagged: int = 0
    subjects_added: int = 0
    topics_added: int = 0
    exam_stage_created: bool = False


def _ingest_syllabus_source(supabase, user_id: str, source: dict, content_bytes, content_type, filename):
    """Returns the parsed tree's exam_date_guess (or None) so the caller can
    decide, once per request, whether to auto-create an exam_stages row."""
    tree = structure_syllabus(content_bytes, content_type, filename)
    upload_row = (
        supabase.table("syllabus_uploads")
        .insert(
            {
                "user_id": user_id,
                "file_name": filename,
                "storage_path": f"web:{source['url']}",
                "parse_status": "completed",
                "language": tree.language,
                "source_url": source["url"],
            }
        )
        .execute()
        .data[0]
    )
    # merge=True: repeated/automatic searches for similar queries reuse an
    # existing same-named subject/topic instead of spamming duplicates (see
    # routers/syllabus.py's _insert_tree docstring).
    subject_count, topic_count = _insert_tree(supabase, user_id, upload_row["id"], tree, merge=True)
    return subject_count, topic_count, tree.exam_date_guess


def _ingest_pyq_source(
    supabase, user_id: str, source: dict, content_bytes, content_type, filename, catalog, exam_year: int | None
):
    paper = structure_pyq_paper(content_bytes, content_type, filename, catalog)
    upload_row = (
        supabase.table("pyq_uploads")
        .insert(
            {
                "user_id": user_id,
                "file_name": filename,
                "storage_path": f"web:{source['url']}",
                "exam_year": exam_year,
                "parse_status": "completed",
                "language": paper.language,
                "source_url": source["url"],
            }
        )
        .execute()
        .data[0]
    )

    questions_added = 0
    duplicates_flagged = 0
    for question in paper.questions:
        topic_id = _resolve_tag(supabase, user_id, question)
        # Dedups against the ENTIRE bank (manual uploads included), not just
        # this batch — see app/embeddings.py's embed_and_dedup docstring.
        embedding, duplicate_of = embed_and_dedup(supabase, user_id, topic_id, question.question_text)
        payload = {
            "user_id": user_id,
            "topic_id": topic_id,
            "pyq_upload_id": upload_row["id"],
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
            duplicates_flagged += 1
        supabase.table("questions").insert(payload).execute()
        questions_added += 1

    return questions_added, duplicates_flagged


@router.post("/search-and-ingest", response_model=SearchAndIngestResponse)
async def search_and_ingest(
    body: SearchAndIngestRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> SearchAndIngestResponse:
    """Finds real syllabus/PYQ material on the web for `body.query` (OpenAI web
    search), downloads each candidate source, and feeds it through the exact
    same Claude-based parsing pipeline the manual upload endpoints use — fully
    automatic, no approval step (the user's explicit choice; every result
    remains editable/deletable afterward via the existing Syllabus/QuestionBank
    UI, so nothing here is irreversible). Optional feature — the frontend only
    shows this control when /health's openai_configured is true; a 503 here
    means it was hit directly without a key configured."""
    if body.kind not in ("syllabus", "pyq"):
        raise HTTPException(status_code=422, detail="kind must be 'syllabus' or 'pyq'")

    try:
        sources = find_material_urls(body.query, max_results=_MAX_SOURCES)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Web search failed: {exc}") from exc

    result = SearchAndIngestResponse(sources_tried=len(sources))
    catalog = _load_catalog(supabase, user_id) if body.kind == "pyq" else None
    exam_date_guess: str | None = None

    for source in sources:
        try:
            content_bytes, content_type, filename = fetch_document(source["url"])
            if content_type == "text/html":
                text = extract_readable_text(content_bytes.decode("utf-8", errors="ignore"))
                content_bytes, content_type = text.encode("utf-8"), "text/plain"

            if body.kind == "syllabus":
                subject_count, topic_count, this_exam_date = _ingest_syllabus_source(
                    supabase, user_id, source, content_bytes, content_type, filename
                )
                result.subjects_added += subject_count
                result.topics_added += topic_count
                exam_date_guess = exam_date_guess or this_exam_date
            else:
                questions_added, duplicates_flagged = _ingest_pyq_source(
                    supabase, user_id, source, content_bytes, content_type, filename, catalog, body.exam_year
                )
                result.questions_added += questions_added
                result.duplicates_flagged += duplicates_flagged

            result.sources_ingested += 1
        except Exception:
            # One bad/unreachable/unparseable source must never fail the
            # whole run — log and move on to the next candidate.
            logger.warning("Skipping unusable material source %s", source.get("url"), exc_info=True)
            result.sources_failed += 1

    if exam_date_guess:
        stage_name = body.query.strip()[:80]
        existing = (
            supabase.table("exam_stages")
            .select("id")
            .eq("user_id", user_id)
            .ilike("name", stage_name)
            .execute()
            .data
        )
        if not existing:
            # Additive only — never overwrites/deletes an existing stage.
            supabase.table("exam_stages").insert(
                {"user_id": user_id, "name": stage_name, "exam_date": exam_date_guess}
            ).execute()
            result.exam_stage_created = True

    return result
