import uuid

import app.routers.chatbot as chatbot_module
from app.auth import get_current_user_id
from app.main import app
from app.supabase_client import get_supabase
from fastapi.testclient import TestClient

client = TestClient(app)


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    """Generic enough to support the filter/order/limit/upsert chains the chatbot
    router uses across daily_targets, daily_checkins, and streaks."""

    def __init__(self, table_rows: list[dict]):
        self._rows = table_rows
        self._filtered = list(table_rows)
        self._pending_insert = None
        self._pending_update = None
        self._order_col = None
        self._order_desc = False
        self._limit = None

    def select(self, columns: str):
        return self

    def insert(self, row: dict):
        row = dict(row)
        row.setdefault("id", str(uuid.uuid4()))
        self._rows.append(row)
        self._pending_insert = row
        return self

    def update(self, fields: dict):
        self._pending_update = fields
        return self

    def upsert(self, row: dict):
        existing = [r for r in self._rows if r.get("user_id") == row.get("user_id")]
        if existing:
            existing[0].update(row)
        else:
            self._rows.append(dict(row))
        self._pending_insert = row
        return self

    def eq(self, column: str, value):
        self._filtered = [r for r in self._filtered if r.get(column) == value]
        return self

    def lte(self, column: str, value):
        self._filtered = [r for r in self._filtered if r.get(column) is not None and r[column] <= value]
        return self

    def order(self, column: str, desc: bool = False):
        self._order_col = column
        self._order_desc = desc
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def execute(self) -> _FakeResult:
        if self._pending_update is not None:
            for row in self._filtered:
                row.update(self._pending_update)
            return _FakeResult(self._filtered)
        if self._pending_insert is not None:
            return _FakeResult([self._pending_insert])

        rows = self._filtered
        if self._order_col:
            rows = sorted(rows, key=lambda r: r.get(self._order_col), reverse=self._order_desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return _FakeResult(rows)


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict]] | None = None):
        self._tables = tables or {}

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self._tables.setdefault(name, []))


def _override(fake_supabase):
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_supabase] = lambda: fake_supabase


def test_start_checkin_creates_row_and_returns_message(monkeypatch):
    monkeypatch.setattr(chatbot_module, "generate_checkin_opening", lambda **kwargs: "Hello! How did it go?")
    fake = FakeSupabase(
        {
            "daily_targets": [
                {"id": "dt1", "user_id": "user-123", "target_date": "2026-09-10", "description": "Study ledgers"}
            ]
        }
    )
    _override(fake)
    try:
        response = client.post(
            "/chatbot/checkin/start", json={"daily_target_id": "dt1", "language": "en"}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Hello! How did it go?"
    checkins = fake._tables["daily_checkins"]
    assert checkins[0]["daily_target_id"] == "dt1"
    assert checkins[0]["transcript"][0]["content"] == "Hello! How did it go?"


def test_finish_checkin_increments_streak_when_continuing(monkeypatch):
    monkeypatch.setattr(chatbot_module, "generate_checkin_closing", lambda **kwargs: "Great job!")
    fake = FakeSupabase(
        {
            "daily_checkins": [
                {
                    "id": "chk1",
                    "user_id": "user-123",
                    "daily_target_id": "dt1",
                    "checkin_date": "2026-09-10",
                    "transcript": [{"role": "assistant", "content": "hi"}],
                }
            ],
            "daily_targets": [{"id": "dt1", "user_id": "user-123", "status": "proposed"}],
            "streaks": [
                {"user_id": "user-123", "current_streak": 2, "longest_streak": 5, "last_active_date": "2026-09-09"}
            ],
        }
    )
    _override(fake)
    try:
        response = client.post(
            "/chatbot/checkin/finish",
            json={
                "checkin_id": "chk1",
                "status": "completed",
                "questions_solved": 10,
                "recall_answers": "yes",
                "language": "en",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["current_streak"] == 3
    assert body["longest_streak"] == 5
    assert fake._tables["daily_targets"][0]["status"] == "completed"


def test_finish_checkin_resets_streak_on_missed(monkeypatch):
    monkeypatch.setattr(chatbot_module, "generate_checkin_closing", lambda **kwargs: "Tomorrow's a new day.")
    fake = FakeSupabase(
        {
            "daily_checkins": [
                {
                    "id": "chk1",
                    "user_id": "user-123",
                    "daily_target_id": "dt1",
                    "checkin_date": "2026-09-10",
                    "transcript": [],
                }
            ],
            "daily_targets": [{"id": "dt1", "user_id": "user-123", "status": "proposed"}],
            "streaks": [
                {"user_id": "user-123", "current_streak": 5, "longest_streak": 5, "last_active_date": "2026-09-09"}
            ],
        }
    )
    _override(fake)
    try:
        response = client.post(
            "/chatbot/checkin/finish",
            json={"checkin_id": "chk1", "status": "missed", "questions_solved": 0},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.json()["current_streak"] == 0


def test_finish_checkin_leaves_streak_unchanged_on_partial(monkeypatch):
    monkeypatch.setattr(chatbot_module, "generate_checkin_closing", lambda **kwargs: "Keep going.")
    fake = FakeSupabase(
        {
            "daily_checkins": [
                {
                    "id": "chk1",
                    "user_id": "user-123",
                    "daily_target_id": "dt1",
                    "checkin_date": "2026-09-10",
                    "transcript": [],
                }
            ],
            "daily_targets": [{"id": "dt1", "user_id": "user-123", "status": "proposed"}],
            "streaks": [
                {"user_id": "user-123", "current_streak": 4, "longest_streak": 6, "last_active_date": "2026-09-09"}
            ],
        }
    )
    _override(fake)
    try:
        response = client.post(
            "/chatbot/checkin/finish",
            json={"checkin_id": "chk1", "status": "partially_completed", "questions_solved": 3},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.json()["current_streak"] == 4
