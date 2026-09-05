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
    except Exception as exc:
        logger.exception("Syllabus parse failed for upload %s", upload_id)
        supabase.table("syllabus_uploads").update(
            {"parse_status": "failed", "error_message": str(exc)}
        ).eq("id", upload_id).execute()
        raise HTTPException(
            status_code=422, detail=f"Could not parse the uploaded file: {exc}"
        ) from exc

    subject_count, topic_count = _insert_tree(supabase, user_id, upload_id, tree)

    supabase.table("syllabus_uploads").update({"parse_status": "completed"}).eq(
        "id", upload_id
    ).execute()

    return UploadResponse(
        upload_id=upload_id,
        parse_status="completed",
        subject_count=subject_count,
        topic_count=topic_count,
    )


def _insert_tree(supabase, user_id: str, upload_id: str, tree: SyllabusTree) -> tuple[int, int]:
    subject_count = 0
    topic_count = 0
    for sort_order, subject in enumerate(tree.subjects):
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
        subject_count += 1

        for topic_sort_order, topic in enumerate(subject.topics):
            topic_row = (
                supabase.table("topics")
                .insert(
                    {
                        "subject_id": subject_row["id"],
                        "name": topic.name,
                        "sort_order": topic_sort_order,
                    }
                )
                .execute()
                .data[0]
            )
            topic_count += 1

            for subtopic_sort_order, subtopic in enumerate(topic.subtopics):
                supabase.table("topics").insert(
                    {
                        "subject_id": subject_row["id"],
                        "parent_topic_id": topic_row["id"],
                        "name": subtopic.name,
                        "sort_order": subtopic_sort_order,
                    }
                ).execute()
                topic_count += 1

    return subject_count, topic_count
