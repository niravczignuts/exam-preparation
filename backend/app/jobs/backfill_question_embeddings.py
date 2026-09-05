"""One-time backfill: computes and stores an embedding for every existing
`questions` row that doesn't have one yet — e.g. rows inserted before
OPENAI_API_KEY was configured, or while an embedding call failed at upload
time (see app/embeddings.py's embed_and_dedup, which never blocks an upload on
this).

Not a scheduled job (render.yaml doesn't wire this up as a cron service) —
new uploads embed themselves inline going forward. Run manually once, after
setting OPENAI_API_KEY in production:
    python -m app.jobs.backfill_question_embeddings
"""

import logging
import sys

from app.embeddings import embed_text
from app.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# A cap, not a page size — a failed row keeps a null embedding and would be
# re-fetched forever by a `while` loop over the same "embedding is null"
# filter, so this does one fetch and iterates in memory instead.
_MAX_ROWS = 5000


def run() -> int:
    """Returns the count of questions that failed to embed."""
    supabase = get_supabase()

    rows = (
        supabase.table("questions")
        .select("id, question_text")
        .is_("embedding", "null")
        .limit(_MAX_ROWS)
        .execute()
        .data
        or []
    )
    logger.info("backfill_question_embeddings: found %d question(s) without an embedding", len(rows))

    failures = 0
    processed = 0
    for row in rows:
        try:
            embedding = embed_text(row["question_text"])
            supabase.table("questions").update({"embedding": embedding}).eq("id", row["id"]).execute()
            processed += 1
        except Exception:
            failures += 1
            logger.exception("failed to embed question %s", row["id"])

    logger.info("backfill_question_embeddings: done, %d embedded, %d failure(s)", processed, failures)
    return failures


if __name__ == "__main__":
    sys.exit(1 if run() > 0 else 0)
