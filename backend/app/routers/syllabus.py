from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.parsing import SyllabusTree, structure_syllabus
from app.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


class UploadResponse(BaseModel):
    upload_id: str
    parse_status: str
    subject_count: int
    topic_count: int


@router.post("/uploads", response_model=UploadResponse)
async def upload_syllabus(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
) -> UploadResponse:
    """Uploads a syllabus file (PDF/DOCX/image), stores it, and auto-parses it
    into a subject -> topic -> sub-topic tree (KAN-19)."""
    file_bytes = await file.read()

    storage_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
    upload_row = (
        supabase.table("syllabus_uploads")
        .insert(
            {
                "user_id": user_id,
                "file_name": file.filename,
                "storage_path": storage_path,
                "parse_status": "processing",
            }
        )
        .execute()
        .data[0]
    )
    upload_id = upload_row["id"]

    try:
        supabase.storage.from_("syllabus-uploads").upload(
            storage_path,
            file_bytes,
            {"content-type": file.content_type or "application/octet-stream"},
        )
        tree = structure_syllabus(file_bytes, file.content_type or "", file.filename or "")
        if tree.language:
            supabase.table("syllabus_uploads").update({"language": tree.language}).eq(
                "id", upload_id
            ).execute()
    except Exception as exc:
        logger.exception("Syllabus parse failed for upload %s", upload_id)
        supabase.table("syllabus_uploads").update(
            {"parse_status": "failed", "error_message": str(exc)}
        ).eq("id", upload_id).execute()
        raise HTTPException(
            status_code=422, detail=f"Could not parse the uploaded file: {exc}"
        ) from exc

    # merge=False: unchanged manual-upload behavior — always inserts a fresh
    # tree, even if a similarly-named subject already exists (see
    # routers/materials.py for the web-search path, which uses merge=True).
    subject_count, topic_count = _insert_tree(supabase, user_id, upload_id, tree, merge=False)

    supabase.table("syllabus_uploads").update({"parse_status": "completed"}).eq(
        "id", upload_id
    ).execute()

    return UploadResponse(
        upload_id=upload_id,
        parse_status="completed",
        subject_count=subject_count,
        topic_count=topic_count,
    )


def _find_by_name(supabase, table: str, name: str, **filters) -> dict | None:
    """Case-insensitive, whitespace-trimmed name lookup — exact match only, no
    fuzzy matching. Pass None as a filter value to match a NULL column (e.g.
    parent_topic_id=None for a top-level topic, vs. a subtopic's real parent
    id) so a top-level topic and a same-named subtopic under a different
    parent are never confused for each other. Used only by merge=True."""
    query = supabase.table(table).select("id").ilike("name", name.strip())
    for column, value in filters.items():
        query = query.is_(column, "null") if value is None else query.eq(column, value)
    rows = query.execute().data
    return rows[0] if rows else None


def _insert_tree(
    supabase, user_id: str, upload_id: str, tree: SyllabusTree, merge: bool
) -> tuple[int, int]:
    """merge=False (manual upload, unchanged): always inserts a fresh
    subject/topic tree, even if a similarly-named subject already exists —
    this is today's existing, tested behavior, left untouched.

    merge=True (web-search ingestion only, see routers/materials.py): reuses
    an existing subject/topic for this user with a matching name instead of
    inserting a duplicate — repeated/automatic searches for similar queries
    would otherwise spam duplicate "Accounting"-style subjects, which the
    one-off manual path tolerates but an automatic path shouldn't. Exact
    case-insensitive name match only, scoped per-user (subjects) or
    per-subject (topics); no fuzzy matching, and no DB-level uniqueness
    constraint backs this — see the migration's comment for why.
    """
    subject_count = 0
    topic_count = 0
    for sort_order, subject in enumerate(tree.subjects):
        existing_subject = (
            _find_by_name(supabase, "subjects", subject.name, user_id=user_id) if merge else None
        )
        if existing_subject:
            subject_id = existing_subject["id"]
        else:
            subject_row = (
                supabase.table("subjects")
                .insert(
                    {
                        "user_id": user_id,
                        "name": subject.name,
                        "sort_order": sort_order,
                        "source_upload_id": upload_id,
                    }
                )
                .execute()
                .data[0]
            )
            subject_id = subject_row["id"]
            subject_count += 1

        for topic_sort_order, topic in enumerate(subject.topics):
            existing_topic = (
                _find_by_name(supabase, "topics", topic.name, subject_id=subject_id, parent_topic_id=None)
                if merge
                else None
            )
            if existing_topic:
                topic_id = existing_topic["id"]
            else:
                topic_row = (
                    supabase.table("topics")
                    .insert(
                        {
                            "subject_id": subject_id,
                            "name": topic.name,
                            "sort_order": topic_sort_order,
                        }
                    )
                    .execute()
                    .data[0]
                )
                topic_id = topic_row["id"]
                topic_count += 1

            for subtopic_sort_order, subtopic in enumerate(topic.subtopics):
                existing_subtopic = (
                    _find_by_name(
                        supabase, "topics", subtopic.name, subject_id=subject_id, parent_topic_id=topic_id
                    )
                    if merge
                    else None
                )
                if existing_subtopic:
                    continue
                supabase.table("topics").insert(
                    {
                        "subject_id": subject_id,
                        "parent_topic_id": topic_id,
                        "name": subtopic.name,
                        "sort_order": subtopic_sort_order,
                    }
                ).execute()
                topic_count += 1

    return subject_count, topic_count
