import datetime
import uuid

import app.jobs.notification_job as job_module
from app.jobs.notification_job import _in_quiet_hours, run


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows: list[dict]):
        self._rows = rows
        self._filtered = list(rows)
        self._pending_insert = None
        self._pending_update = None

    def select(self, columns: str):
        return self

    def insert(self, row: dict):
        row = dict(row)
        row.setdefault("id", str(uuid.uuid4()))
        # Mimic the (user_id, dedupe_key) unique index from migration 0007.
        if row.get("dedupe_key") is not None:
            for existing in self._rows:
                if existing.get("user_id") == row.get("user_id") and existing.get("dedupe_key") == row.get(
                    "dedupe_key"
                ):
                    raise Exception("duplicate key value violates unique constraint")
        self._rows.append(row)
        self._pending_insert = row
        return self

    def update(self, fields: dict):
        self._pending_update = fields
        return self

    def eq(self, column: str, value):
        self._filtered = [r for r in self._filtered if r.get(column) == value]
        return self

    def lte(self, column: str, value):
        self._filtered = [r for r in self._filtered if r.get(column) is not None and r[column] <= value]
        return self

    def gte(self, column: str, value):
        self._filtered = [r for r in self._filtered if r.get(column) is not None and r[column] >= value]
        return self

    def execute(self) -> _FakeResult:
        if self._pending_update is not None:
            for row in self._filtered:
                row.update(self._pending_update)
            return _FakeResult(self._filtered)
        if self._pending_insert is not None:
            return _FakeResult([self._pending_insert])
        return _FakeResult(self._filtered)


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict]] | None = None):
        self._tables = tables or {}

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self._tables.setdefault(name, []))


def test_in_quiet_hours_simple_window():
    settings_row = {"quiet_hours_start": "22:00:00", "quiet_hours_end": "06:00:00"}
    late_night = datetime.datetime(2026, 1, 1, 23, 0, tzinfo=job_module.IST)
    midday = datetime.datetime(2026, 1, 1, 13, 0, tzinfo=job_module.IST)
    assert _in_quiet_hours(settings_row, late_night) is True
    assert _in_quiet_hours(settings_row, midday) is False


def test_in_quiet_hours_no_window_configured():
    assert _in_quiet_hours({"quiet_hours_start": None, "quiet_hours_end": None}, datetime.datetime.now(job_module.IST)) is False


def test_pending_target_notification_sent_once(monkeypatch):
    fixed_now = datetime.datetime(2026, 9, 10, 11, 0, tzinfo=job_module.IST)
    monkeypatch.setattr(job_module, "_now_ist", lambda: fixed_now)
    monkeypatch.setattr(job_module, "send_push", lambda *a, **k: "msg-id")

    today = fixed_now.date().isoformat()
    fake = FakeSupabase(
        {
            "settings": [{"user_id": "u1", "notification_prefs": {}, "quiet_hours_start": None, "quiet_hours_end": None}],
            "device_tokens": [{"user_id": "u1", "fcm_token": "tok1"}],
            "daily_targets": [{"user_id": "u1", "target_date": today, "status": "proposed"}],
        }
    )
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    failures = run()
    assert failures == 0

    logs = [r for r in fake._tables["notification_log"] if r["notification_type"] == "pending_target"]
    assert len(logs) == 1
    assert logs[0]["status"] == "sent"

    # Running again the same "tick" must not double-send (dedupe claim).
    run()
    logs_after = [r for r in fake._tables["notification_log"] if r["notification_type"] == "pending_target"]
    assert len(logs_after) == 1


def test_no_notification_when_no_device_token(monkeypatch):
    fixed_now = datetime.datetime(2026, 9, 10, 11, 0, tzinfo=job_module.IST)
    monkeypatch.setattr(job_module, "_now_ist", lambda: fixed_now)
    monkeypatch.setattr(job_module, "send_push", lambda *a, **k: "msg-id")

    fake = FakeSupabase(
        {
            "settings": [{"user_id": "u1", "notification_prefs": {}, "quiet_hours_start": None, "quiet_hours_end": None}],
            "device_tokens": [],
            "daily_targets": [{"user_id": "u1", "target_date": fixed_now.date().isoformat(), "status": "proposed"}],
        }
    )
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    run()
    assert fake._tables.get("notification_log", []) == []


def test_respects_disabled_preference(monkeypatch):
    fixed_now = datetime.datetime(2026, 9, 10, 11, 0, tzinfo=job_module.IST)
    monkeypatch.setattr(job_module, "_now_ist", lambda: fixed_now)
    monkeypatch.setattr(job_module, "send_push", lambda *a, **k: "msg-id")

    fake = FakeSupabase(
        {
            "settings": [
                {
                    "user_id": "u1",
                    "notification_prefs": {"pendingTarget": False},
                    "quiet_hours_start": None,
                    "quiet_hours_end": None,
                }
            ],
            "device_tokens": [{"user_id": "u1", "fcm_token": "tok1"}],
            "daily_targets": [{"user_id": "u1", "target_date": fixed_now.date().isoformat(), "status": "proposed"}],
        }
    )
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    run()
    logs = [r for r in fake._tables.get("notification_log", []) if r["notification_type"] == "pending_target"]
    assert logs == []


def test_motivational_uses_missed_variant_after_a_missed_day(monkeypatch):
    fixed_now = datetime.datetime(2026, 9, 10, 9, 0, tzinfo=job_module.IST)
    monkeypatch.setattr(job_module, "_now_ist", lambda: fixed_now)
    monkeypatch.setattr(job_module, "send_push", lambda *a, **k: "msg-id")
    monkeypatch.setattr(job_module.random, "choice", lambda options: options[0])

    yesterday = (fixed_now.date() - datetime.timedelta(days=1)).isoformat()
    fake = FakeSupabase(
        {
            "settings": [{"user_id": "u1", "notification_prefs": {}, "quiet_hours_start": None, "quiet_hours_end": None}],
            "device_tokens": [{"user_id": "u1", "fcm_token": "tok1"}],
            "daily_targets": [{"user_id": "u1", "target_date": yesterday, "status": "missed"}],
        }
    )
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    run()
    logs = [r for r in fake._tables["notification_log"] if r["notification_type"] == "motivational"]
    assert len(logs) == 1
    assert "missed" in logs[0]["dedupe_key"]
