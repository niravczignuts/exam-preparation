from __future__ import annotations

import logging

from app.openai_client import get_openai_client

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


def embed_text(text: str) -> list[float]:
    response = get_openai_client().embeddings.create(model=EMBEDDING_MODEL, input=text)
    return response.data[0].embedding


def embed_and_dedup(
    supabase, user_id: str, topic_id: str | None, question_text: str
) -> tuple[list[float] | None, str | None]:
    """Best-effort embedding + near-duplicate lookup for one question, shared by
    every question-ingestion path (manual PYQ upload, web-search ingestion) so
    dedup checks the *entire* bank consistently regardless of source.

    Returns (embedding, duplicate_of), both None if OPENAI_API_KEY isn't set or
    either OpenAI/Supabase call fails — this is a purely additive enhancement,
    parsing/upload must never fail because of it (see docs/SETUP.md)."""
    try:
        embedding = embed_text(question_text)
    except Exception:
        logger.warning("Embedding skipped for a question (OpenAI not configured or call failed)")
        return None, None

    try:
        matches = (
            supabase.rpc(
                "match_questions",
                {
                    "query_embedding": embedding,
                    "match_user_id": user_id,
                    "match_topic_id": topic_id,
                    "match_threshold": 0.90,
                    "match_count": 1,
                },
            )
            .execute()
            .data
            or []
        )
    except Exception:
        logger.warning("Duplicate check failed for a question")
        matches = []

    return embedding, (matches[0]["id"] if matches else None)
