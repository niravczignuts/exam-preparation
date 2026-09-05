from __future__ import annotations

import base64
import io
from functools import lru_cache

import anthropic
from docx import Document
from pydantic import BaseModel, Field

from app.config import settings


@lru_cache
def _client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Get one from console.anthropic.com "
            "and add it to backend/.env (see backend/.env.example)."
        )
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


class SubTopic(BaseModel):
    name: str


class Topic(BaseModel):
    name: str
    subtopics: list[SubTopic] = Field(default_factory=list)


class Subject(BaseModel):
    name: str
    topics: list[Topic] = Field(default_factory=list)


class SyllabusTree(BaseModel):
    subjects: list[Subject]


_PROMPT = (
    "This file is a syllabus for a competitive exam (GSET Commerce or similar). "
    "Read it and structure its content into a subject -> topic -> sub-topic "
    "hierarchy. Use the document's own headings/numbering to decide the "
    "hierarchy. Every subject must have at least one topic; a topic may have "
    "zero sub-topics if the document doesn't break it down further. Do not "
    "invent content that isn't in the document."
)

_IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _extract_docx_text(file_bytes: bytes) -> str:
    document = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in document.paragraphs if p.text.strip())


def structure_syllabus(file_bytes: bytes, content_type: str, filename: str) -> SyllabusTree:
    """Turns an uploaded syllabus file into a structured tree via one LLM call.

    PDFs and images are sent to Claude directly (native document/vision
    understanding — no OCR library needed, and scanned PDFs work too). DOCX
    has no native input type, so its text is extracted first.

    Raises ValueError on an unsupported file type or a result the model
    couldn't structure — callers must surface this as a clear failure
    (KAN-19 AC), never fall back to a silently empty tree.
    """
    if content_type == "application/pdf":
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": base64.standard_b64encode(file_bytes).decode(),
                },
            },
            {"type": "text", "text": _PROMPT},
        ]
    elif content_type in _IMAGE_MEDIA_TYPES:
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": content_type,
                    "data": base64.standard_b64encode(file_bytes).decode(),
                },
            },
            {"type": "text", "text": _PROMPT},
        ]
    elif content_type == _DOCX_MEDIA_TYPE or filename.lower().endswith(".docx"):
        text = _extract_docx_text(file_bytes)
        if not text.strip():
            raise ValueError("The .docx file has no extractable text")
        content = [{"type": "text", "text": f"{_PROMPT}\n\n---\n\n{text}"}]
    else:
        raise ValueError(f"Unsupported file type: {content_type or filename}")

    response = _client().messages.parse(
        model="claude-sonnet-5",
        max_tokens=16000,
        messages=[{"role": "user", "content": content}],
        output_format=SyllabusTree,
    )
    tree = response.parsed_output
    if not tree.subjects:
        raise ValueError("Could not identify any subjects in the uploaded file")
    return tree
