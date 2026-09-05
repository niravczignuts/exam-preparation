import io
import uuid

import app.auth as auth_module
import app.routers.syllabus as syllabus_module
import jwt
import pytest
from app.auth import get_current_user_id
from app.main import app
from app.parsing import Subject, SyllabusTree, Topic
from app.supabase_client import get_supabase
from fastapi import HTTPException
from fastapi.testclient import TestClient

client = TestClient(app)


def test_get_current_user_id_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(auth_module.settings, "supabase_jwt_secret", "test-secret")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(authorization="Bearer not-a-valid-jwt")
    assert exc_info.value.status_code == 401


def test_get_current_user_id_accepts_valid_token(monkeypatch):
    monkeypatch.setattr(auth_module.settings, "supabase_jwt_secret", "test-secret")
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"}, "test-secret", algorithm="HS256"
    )
    assert get_current_user_id(authorization=f"Bearer {token}") == "user-123"


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
        self._eq = None

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
        self._eq = (column, value)
        return self

    def execute(self) -> _FakeResult:
        if self._update_fields is not None:
            matched = [r for r in self._table.rows if r.get(self._eq[0]) == self._eq[1]]
            for row in matched:
                row.update(self._update_fields)
            return _FakeResult(matched)
        return _FakeResult([self._pending_insert])


class _FakeStorageBucket:
    def upload(self, path, data, options=None):
        return {"path": path}


class _FakeStorage:
    def from_(self, bucket: str) -> _FakeStorageBucket:
        return _FakeStorageBucket()


class FakeSupabase:
    """Minimal stand-in for the supabase-py client, just enough to exercise
    the insert/update chains the syllabus upload route uses — no real
    network or Anthropic call happens in this test."""

    def __init__(self):
        self._tables: dict[str, _FakeTable] = {}
        self.storage = _FakeStorage()

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self._tables.setdefault(name, _FakeTable()))


def test_upload_syllabus_success(monkeypatch):
    fake_supabase = FakeSupabase()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_supabase] = lambda: fake_supabase

    canned_tree = SyllabusTree(
        subjects=[
            Subject(name="Accounting", topics=[Topic(name="Ledgers", subtopics=[])]),
        ]
    )
    monkeypatch.setattr(syllabus_module, "structure_syllabus", lambda *a, **k: canned_tree)

    try:
        response = client.post(
            "/syllabus/uploads",
            files={"file": ("syllabus.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["parse_status"] == "completed"
    assert body["subject_count"] == 1
    assert body["topic_count"] == 1


def test_upload_syllabus_marks_failed_on_parse_error(monkeypatch):
    fake_supabase = FakeSupabase()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_supabase] = lambda: fake_supabase

    def _boom(*args, **kwargs):
        raise ValueError("model could not structure this file")

    monkeypatch.setattr(syllabus_module, "structure_syllabus", _boom)

    try:
        response = client.post(
            "/syllabus/uploads",
            files={"file": ("syllabus.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    upload_rows = fake_supabase._tables["syllabus_uploads"].rows
    assert upload_rows[0]["parse_status"] == "failed"
