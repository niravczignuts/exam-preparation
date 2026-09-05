from __future__ import annotations

# Languages that use Latin script themselves — no script mismatch is possible,
# so nothing to guard against.
_LATIN_SCRIPT_LANGUAGES = {"en"}


def guard_language(language: str | None, text: str) -> str | None:
    """Best-effort safety net: if `language` claims a non-Latin-script language
    (e.g. "gu" for Gujarati) but `text` is mostly ASCII, the model likely
    translated to English despite being told not to — discard the claim rather
    than store a confidently-wrong tag. Never raises; a bad/empty `text` just
    passes `language` through unchanged."""
    if not language or language in _LATIN_SCRIPT_LANGUAGES or not text:
        return language
    ascii_chars = sum(1 for ch in text if ord(ch) < 128)
    if ascii_chars / len(text) > 0.8:
        return None
    return language
