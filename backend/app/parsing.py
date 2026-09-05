from __future__ import annotations

import base64
import io

from docx import Document
from pydantic import BaseModel, Field

from app.anthropic_client import get_anthropic_client as _client


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


class Question(BaseModel):
    question_text: str
    options: list[str] = Field(
        default_factory=list,
        description="Multiple-choice options in order, e.g. ['A. ...', 'B. ...']. Empty for a "
        "subjective/short-answer question with no fixed options.",
    )
    correct_answer: str | None = Field(
        default=None,
        description="The correct option text (for MCQs) or a model answer (for subjective "
        "questions). Generate this yourself if the paper doesn't include an answer key — "
        "KAN-25 adds Q&A directly with no manual approval step, so this must never be left "
        "blank when a defensible answer exists.",
    )
    explanation: str | None = Field(
        default=None, description="A short explanation of why the answer is correct."
    )
    subject_guess: str | None = Field(
        default=None,
        description="Best-guess name of which of the user's existing subjects this question "
        "belongs to (pick from the provided list verbatim), or null if none fit.",
    )
    topic_guess: str | None = Field(
        default=None,
        description="Best-guess name of which of the user's existing topics (under that "
        "subject) this question belongs to (pick from the provided list verbatim), or null.",
    )


class PyqPaper(BaseModel):
    questions: list[Question]


_PYQ_PROMPT_TEMPLATE = (
    "This file is a previous-year question (PYQ) paper for a competitive exam (GSET Commerce "
    "or similar). Extract every individual question from it. For each question:\n"
    "- Reproduce the question text as written.\n"
    "- If it has fixed answer options (MCQ), list them in `options`.\n"
    "- Always fill `correct_answer` with the correct option or a model answer — generate one "
    "yourself using your own subject-matter knowledge if the paper has no answer key. Never "
    "leave a question without an answer.\n"
    "- Add a brief `explanation` for the answer.\n"
    "- Guess which existing subject/topic (from the lists below) the question best fits, using "
    "the exact name from the list, or null if none fit reasonably.\n\n"
    "Existing subjects and topics for this user:\n{catalog}\n\n"
    "Do not invent questions that aren't in the document."
)


def _format_catalog(catalog: list[dict]) -> str:
    if not catalog:
        return "(none yet — leave subject_guess/topic_guess null)"
    lines = []
    for subject in catalog:
        lines.append(f"- {subject['name']}")
        for topic in subject.get("topics", []):
            lines.append(f"  - {topic['name']}")
    return "\n".join(lines)


def structure_pyq_paper(
    file_bytes: bytes, content_type: str, filename: str, catalog: list[dict]
) -> PyqPaper:
    """Extracts and auto-answers every question in an uploaded PYQ paper (KAN-24, KAN-25).

    `catalog` is the user's existing subjects (each with a `topics` list of {id, name}),
    used so the model can best-guess a tag for each question (KAN-26) — callers resolve the
    guessed names back to ids since names alone aren't unique/reliable enough to store.

    Same native-document/vision/DOCX-text handling as structure_syllabus; raises ValueError
    on an unsupported file type or no extractable questions.
    """
    prompt = _PYQ_PROMPT_TEMPLATE.format(catalog=_format_catalog(catalog))

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
            {"type": "text", "text": prompt},
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
            {"type": "text", "text": prompt},
        ]
    elif content_type == _DOCX_MEDIA_TYPE or filename.lower().endswith(".docx"):
        text = _extract_docx_text(file_bytes)
        if not text.strip():
            raise ValueError("The .docx file has no extractable text")
        content = [{"type": "text", "text": f"{prompt}\n\n---\n\n{text}"}]
    else:
        raise ValueError(f"Unsupported file type: {content_type or filename}")

    response = _client().messages.parse(
        model="claude-sonnet-5",
        max_tokens=16000,
        messages=[{"role": "user", "content": content}],
        output_format=PyqPaper,
    )
    paper = response.parsed_output
    if not paper.questions:
        raise ValueError("Could not identify any questions in the uploaded file")
    return paper
