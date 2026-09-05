from functools import lru_cache

import anthropic

from app.config import settings


@lru_cache
def get_anthropic_client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Get one from console.anthropic.com "
            "and add it to backend/.env (see backend/.env.example)."
        )
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)
