import io
import uuid

import app.routers.pyq as pyq_module
from app.auth import get_current_user_id
from app.main import app
from app.parsing import PyqPaper, Question
from app.supabase_client import get_supabase
from fastapi.testclient import TestClient

client = TestClient(app)


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self):
        self.rows: list[dict] = []


class _FakeQuery:
    def __init__(self, table: _FakeTable):
        self._table = table
        self._pending_insert = None
        self._update_fields = None
        self._eqs: list[tuple[str, object]] = []
        self._select = None

    def select(self, columns: str):
        self._select = columns
        return self

    def insert(self, row: dict):
        row = dict(row)
        row.setdefault("id", str(uuid.uuid4()))
        self._table.rows.append(row)
        self._pending_insert = row
        return self

    def update(self, fields: dict):
        self._update_fields = fields
        return self

    def eq(self, column: str, value):
        self._eqs.append((column, value))
        return self

    def execute(self) -> _FakeResult:
        if self._update_fields is not None:
            matched = [
                r for r in self._table.rows if all(r.get(c) == v for c, v in self._eqs)
            ]
            for row in matched:
                row.update(self._update_fields)
            return _FakeResult(matched)
        if self._pending_insert is not None:
            return _FakeResult([self._pending_insert])
        # A plain select (catalog lookup / tag resolution) — no rows in this
        # fake by default, callers monkeypatch behavior where it matters.
        return _FakeResult([])


class _FakeStorageBucket:
    def upload(self, path, data, options=None):
        return {"path": path}


class _FakeStorage:
    def from_(self, bucket: str) -> _FakeStorageBucket:
        return _FakeStorageBucket()


class FakeSupabase:
    def __init__(self):
        self._tables: dict[str, _FakeTable] = {}
        self.storage = _FakeStorage()

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self._tables.setdefault(name, _FakeTable()))


def test_resolve_tag_returns_none_without_a_guess():
    assert pyq_module._resolve_tag(FakeSupabase(), "user-123", Question(question_text="Q")) is None


def test_resolve_tag_matches_by_name(monkeypatch):
    fake_supabase = FakeSupabase()

    def _fake_select(self, columns):
        self._select = columns
        self._canned = [{"id": "topic-abc", "name": "Ledgers"}]
        return self

    def _fake_execute(self):
        if self._update_fields is not None or self._pending_insert is not None:
            return _FakeResult([])
        return _FakeResult(getattr(self, "_canned", []))

    monkeypatch.setattr(_FakeQuery, "select", _fake_select)
    monkeypatch.setattr(_FakeQuery, "execute", _fake_execute)

    question = Question(question_text="Q", subject_guess="Accounting", topic_guess="Ledgers")
    topic_id = pyq_module._resolve_tag(fake_supabase, "user-123", question)
    assert topic_id == "topic-abc"


def test_upload_pyq_papers_success(monkeypatch):
    fake_supabase = FakeSupabase()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_supabase] = lambda: fake_supabase

    canned_paper = PyqPaper(
        questions=[
            Question(
                question_text="What is a ledger?",
                options=["A book of accounts", "A tax form"],
                correct_answer="A book of accounts",
                explanation="A ledger records all transactions by account.",
                subject_guess=None,
                topic_guess=None,
            )
        ]
    )
    monkeypatch.setattr(pyq_module, "structure_pyq_paper", lambda *a, **k: canned_paper)

    try:
        response = client.post(
            "/pyq/uploads",
            files={"files": ("paper-2023.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
            data={"exam_year": "2023"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 1
    assert body["results"][0]["parse_status"] == "completed"
    assert body["results"][0]["question_count"] == 1
    question_rows = fake_supabase._tables["questions"].rows
    assert question_rows[0]["question_text"] == "What is a ledger?"
    assert question_rows[0]["exam_year"] == 2023


def test_upload_pyq_papers_one_failure_does_not_block_batch(monkeypatch):
    fake_supabase = FakeSupabase()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_supabase] = lambda: fake_supabase

    canned_paper = PyqPaper(
        questions=[Question(question_text="Q1", correct_answer="A1")]
    )
    calls = {"n": 0}

    def _flaky(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise ValueError("could not read this file")
        return canned_paper

    monkeypatch.setattr(pyq_module, "structure_pyq_paper", _flaky)

    try:
        response = client.post(
            "/pyq/uploads",
            files=[
                ("files", ("bad.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")),
                ("files", ("good.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")),
            ],
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    results = response.json()["results"]
    assert results[0]["parse_status"] == "failed"
    assert results[0]["error"] == "could not read this file"
    assert results[1]["parse_status"] == "completed"
    assert results[1]["question_count"] == 1

    upload_rows = fake_supabase._tables["pyq_uploads"].rows
    assert upload_rows[0]["parse_status"] == "failed"
    assert upload_rows[1]["parse_status"] == "completed"
