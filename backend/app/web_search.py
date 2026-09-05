from __future__ import annotations

from app.openai_client import get_openai_client

# Web search (Responses API tool) is only available on select models — verify
# this is still true for whatever's current on your OpenAI account.
_MODEL = "gpt-4o-mini"


def find_material_urls(query: str, max_results: int = 5) -> list[dict]:
    """Uses OpenAI's Responses API web_search tool to find candidate source
    URLs for `query` (e.g. "GSET Commerce syllabus 2024"). Returns up to
    max_results {"url", "title"} dicts, deduped, in the order OpenAI cited
    them. Raises RuntimeError (via get_openai_client) if OPENAI_API_KEY isn't
    configured, or whatever the OpenAI SDK raises on an API-level failure —
    callers should treat both as "search unavailable," not crash the caller."""
    response = get_openai_client().responses.create(
        model=_MODEL,
        tools=[{"type": "web_search"}],
        input=query,
    )

    seen: set[str] = set()
    results: list[dict] = []
    for item in response.output:
        if item.type != "message":
            continue
        for content in item.content:
            for annotation in getattr(content, "annotations", None) or []:
                if annotation.type != "url_citation" or annotation.url in seen:
                    continue
                seen.add(annotation.url)
                results.append({"url": annotation.url, "title": annotation.title})
                if len(results) >= max_results:
                    return results
    return results
