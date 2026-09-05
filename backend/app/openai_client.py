from functools import lru_cache

import openai

from app.config import settings


@lru_cache
def get_openai_client() -> openai.OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Get one from platform.openai.com "
            "and add it to backend/.env (see backend/.env.example)."
        )
    return openai.OpenAI(api_key=settings.openai_api_key)
