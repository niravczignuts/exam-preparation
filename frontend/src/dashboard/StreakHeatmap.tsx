import { useMemo, useState } from "react";

import type { DayRecord } from "./useDashboardData";

const STATUS_CLASS: Record<string, string> = {
  completed: "bg-success",
  partially_completed: "bg-warning",
  missed: "bg-destructive",
};

/** KAN-54: a GitHub-style calendar heatmap of completed/partial/missed days.
 * Status colors are the app's reserved status palette (success/warning/
 * destructive) — never reused for anything else — with a muted cell for days
 * with no record (not yet reached, or no target existed). */
export function StreakHeatmap({ days }: { days: DayRecord[] }) {
  const [hover, setHover] = useState<DayRecord | null>(null);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const weeks = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 83); // 12 weeks back
    // Align to the most recent Sunday on/before start.
    start.setDate(start.getDate() - start.getDay());

    const cols: { date: string; status: string | null }[][] = [];
    let col: { date: string; status: string | null }[] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const dateStr = cursor.toISOString().slice(0, 10);
      col.push({ date: dateStr, status: byDate.get(dateStr)?.status ?? null });
      if (cursor.getDay() === 6) {
        cols.push(col);
        col = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (col.length) cols.push(col);
    return cols;
  }, [byDate]);

  return (
    <div className="relative">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((day) => (
              <div
                key={day.date}
                onMouseEnter={() => setHover(day.status ? { date: day.date, status: day.status as never } : null)}
                onMouseLeave={() => setHover(null)}
                className={`size-3 rounded-sm ${day.status ? STATUS_CLASS[day.status] || "bg-muted" : "bg-muted"}`}
              />
            ))}
          </div>
        ))}
      </div>
      {hover && (
        <div className="bg-popover text-popover-foreground pointer-events-none absolute -top-8 left-0 rounded-md border px-2 py-1 text-xs shadow-md">
          {hover.date} · {hover.status.replace("_", " ")}
        </div>
      )}
    </div>
  );
}
