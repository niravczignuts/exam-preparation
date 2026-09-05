import datetime

import app.jobs.daily_target_job as job_module
from app.jobs.daily_target_job import run


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, table_rows: list[dict]):
        self._rows = table_rows
        self._eqs: list[tuple[str, object]] = []
        self._pending_insert = None

    def select(self, columns: str):
        return self

    def insert(self, row: dict):
        self._pending_insert = row
        self._rows.append(row)
        return self

    def eq(self, column: str, value):
        self._eqs.append((column, value))
        return self

    def execute(self) -> _FakeResult:
        if self._pending_insert is not None:
            return _FakeResult([self._pending_insert])
        matched = [r for r in self._rows if all(r.get(c) == v for c, v in self._eqs)]
        return _FakeResult(matched)


class FakeSupabase:
    def __init__(self, settings_rows, daily_target_rows, timetable_session_rows=None):
        self._tables = {
            "settings": settings_rows,
            "daily_targets": daily_target_rows,
            "timetable_sessions": timetable_session_rows or [],
            "notification_log": [],
        }

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self._tables[name])


def test_generates_target_for_tomorrow_not_today(monkeypatch):
    today = datetime.date.today().isoformat()
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    fake = FakeSupabase(settings_rows=[{"user_id": "u1"}], daily_target_rows=[])
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    failures = run()

    assert failures == 0
    created = fake._tables["daily_targets"]
    assert len(created) == 1
    assert created[0]["target_date"] == tomorrow
    assert created[0]["target_date"] != today


def test_skips_user_who_already_has_tomorrows_target(monkeypatch):
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    fake = FakeSupabase(
        settings_rows=[{"user_id": "u1"}],
        daily_target_rows=[{"user_id": "u1", "target_date": tomorrow, "id": "existing"}],
    )
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    run()

    created = fake._tables["daily_targets"]
    assert len(created) == 1  # only the pre-existing row — nothing new inserted


def test_carries_forward_unfinished_work_from_missed_day(monkeypatch):
    today = datetime.date.today().isoformat()
    fake = FakeSupabase(
        settings_rows=[{"user_id": "u1"}],
        daily_target_rows=[
            {
                "user_id": "u1",
                "target_date": today,  # "yesterday" relative to the job's target of tomorrow
                "status": "missed",
                "description": "Finish Accounting ledgers",
            }
        ],
    )
    monkeypatch.setattr(job_module, "get_supabase", lambda: fake)

    run()

    created = fake._tables["daily_targets"]
    new_row = created[-1]
    assert "Finish Accounting ledgers" in new_row["description"]
