from __future__ import annotations

from app.openai_client import get_openai_client

_LANGUAGE_NAMES = {"gu": "Gujarati", "en": "English"}

_SYSTEM_PROMPT_TEMPLATE = (
    "You are a knowledgeable, patient tutor helping a GSET Commerce exam aspirant "
    "with a specific doubt/question. Answer clearly and concisely, in {lang_name}, "
    "using worked examples where helpful. If the question is ambiguous, ask a brief "
    "clarifying question instead of guessing."
)


def generate_doubt_reply(*, history: list[dict], language: str) -> str:
    """`history` is the full thread transcript so far (oldest first), each item
    {"role": "user"|"assistant", "content": str}, ending with the student's latest
    message. Returns the assistant's reply text."""
    lang_name = _LANGUAGE_NAMES.get(language, "English")
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(lang_name=lang_name)

    response = get_openai_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": system_prompt}, *history],
    )
    return response.choices[0].message.content.strip()
