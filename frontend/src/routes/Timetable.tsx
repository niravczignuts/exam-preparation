import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useExamStages } from "@/hooks/useExamStages";
import { flattenTopics } from "@/syllabus/flattenTopics";
import { useSyllabusTree } from "@/syllabus/useSyllabusTree";
import { suggestTimetable, type ProposedSession } from "@/timetable/suggestTimetable";
import {
  addSession,
  deleteSession,
  sessionsOverlap,
  updateSession,
  useTimetable,
  type TimetableSession,
} from "@/timetable/useTimetable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "day" | "week" | "month";

const EMPTY_SESSIONS: TimetableSession[] = [];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function startOfWeek(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}

function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function formatShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function EditSessionDialog({
  session,
  topicOptions,
  existingSessions,
  onSaved,
  onClose,
}: {
  session: TimetableSession;
  topicOptions: ReturnType<typeof flattenTopics>;
  existingSessions: TimetableSession[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [topicId, setTopicId] = useState(session.topic_id ?? "");
  const [date, setDate] = useState(session.session_date);
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(session.end_time.slice(0, 5));

  const overlapping = existingSessions.some(
    (s) =>
      s.id !== session.id &&
      s.session_date === date &&
      s.status !== "missed" &&
      sessionsOverlap({ start_time: `${startTime}:00`, end_time: `${endTime}:00` }, s),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const topic = topicOptions.find((t) => t.id === topicId);
    const { error } = await updateSession(session.id, {
      subject_id: topic?.subjectId ?? null,
      topic_id: topicId || null,
      session_date: date,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
    });
    if (error) {
      toast.error(error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Topic</Label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              required
              className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs outline-none"
            >
              <option value="" disabled>
                Select a topic
              </option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          {overlapping && (
            <p className="text-warning flex items-center gap-1.5 text-xs">
              <AlertTriangleIcon className="size-3.5" /> Overlaps another session on this day.
            </p>
          )}
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({
  session,
  topicOptions,
  existingSessions,
  onMarkComplete,
  onDelete,
  onChanged,
}: {
  session: TimetableSession;
  topicOptions: ReturnType<typeof flattenTopics>;
  existingSessions: TimetableSession[];
  onMarkComplete: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {session.topics?.subjects?.name ?? "Untagged"} — {session.topics?.name ?? "Session"}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge
          variant={
            session.status === "completed"
              ? "success"
              : session.status === "missed"
                ? "destructive"
                : "outline"
          }
        >
          {session.status}
        </Badge>
        {session.status === "scheduled" && (
          <Button variant="ghost" size="sm" className="h-7" onClick={onMarkComplete}>
            Done
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(true)}>
          <PencilIcon className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onDelete}>
          <TrashIcon className="size-3.5" />
        </Button>
      </div>
      {editing && (
        <EditSessionDialog
          session={session}
          topicOptions={topicOptions}
          existingSessions={existingSessions}
          onSaved={onChanged}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function AddSessionDialog({
  topicOptions,
  defaultDate,
  existingSessions,
  onAdded,
}: {
  topicOptions: ReturnType<typeof flattenTopics>;
  defaultDate: string;
  existingSessions: TimetableSession[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const overlapping = existingSessions.some(
    (s) =>
      s.session_date === date &&
      s.status !== "missed" &&
      sessionsOverlap({ start_time: `${startTime}:00`, end_time: `${endTime}:00` }, s),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const topic = topicOptions.find((t) => t.id === topicId);
    const { error } = await addSession({
      subjectId: topic?.subjectId ?? null,
      topicId: topicId || null,
      sessionDate: date,
      startTime: `${startTime}:00`,
      endTime: `${endTime}:00`,
    });
    if (error) {
      toast.error(error);
      return;
    }
    setOpen(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> Add session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add study session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Topic</Label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              required
              className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs outline-none"
            >
              <option value="" disabled>
                Select a topic
              </option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          {overlapping && (
            <p className="text-warning flex items-center gap-1.5 text-xs">
              <AlertTriangleIcon className="size-3.5" /> Overlaps another session on this day.
            </p>
          )}
          <DialogFooter>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AutoSuggestDialog({ onSaved }: { onSaved: () => void }) {
  const { subjects } = useSyllabusTree();
  const { stages } = useExamStages();
  const [open, setOpen] = useState(false);
  const [proposed, setProposed] = useState<ProposedSession[] | null>(null);
  const [saving, setSaving] = useState(false);

  const nearestExam = useMemo(() => {
    const today = toDateStr(new Date());
    return stages
      .filter((s) => s.exam_date >= today)
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date))[0];
  }, [stages]);

  function handleGenerate() {
    if (subjects === "loading") return;
    if (!nearestExam) {
      toast.error("Add an upcoming exam date in Settings first.");
      return;
    }
    const { sessions, error } = suggestTimetable(subjects, nearestExam.exam_date);
    if (error) {
      toast.error(error);
      setProposed(null);
      return;
    }
    setProposed(sessions);
  }

  async function handleSave() {
    if (!proposed) return;
    setSaving(true);
    for (const s of proposed) {
      await addSession({
        subjectId: s.subjectId,
        topicId: s.topicId,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
      });
    }
    setSaving(false);
    toast.success(`Saved ${proposed.length} sessions`);
    setOpen(false);
    setProposed(null);
    onSaved();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setProposed(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SparklesIcon /> Auto-suggest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Auto-suggested timetable</DialogTitle>
        </DialogHeader>
        {!proposed ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Distributes your remaining (not-completed) syllabus topics across the days left
              until{" "}
              {nearestExam ? (
                <strong>{nearestExam.name}</strong>
              ) : (
                "your next configured exam date"
              )}
              .
            </p>
            <Button onClick={handleGenerate} className="w-fit">
              Generate proposal
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              {proposed.length} sessions proposed. Review below, then save — you can still edit or
              delete individual sessions afterwards.
            </p>
            <div className="max-h-80 overflow-y-auto rounded-md border">
              {proposed.map((s, i) => (
                <div
                  key={`${s.topicId}-${i}`}
                  className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate">
                    {s.subjectName} — {s.topicName}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatShort(s.sessionDate)} {s.startTime.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProposed(null)}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                Save {proposed.length} sessions
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MissedSessionBanner({
  missed,
  allSessions,
  onResolved,
}: {
  missed: TimetableSession;
  allSessions: TimetableSession[];
  onResolved: () => void;
}) {
  const suggestion = useMemo(() => {
    for (let i = 1; i <= 14; i++) {
      const date = addDays(toDateStr(new Date()), i);
      const daySessions = allSessions.filter((s) => s.session_date === date && s.status !== "missed");
      const candidate = { start_time: missed.start_time, end_time: missed.end_time };
      if (!daySessions.some((s) => sessionsOverlap(candidate, s))) {
        return { sessionDate: date, startTime: missed.start_time, endTime: missed.end_time };
      }
    }
    return null;
  }, [missed, allSessions]);

  async function handleAccept() {
    if (!suggestion) return;
    await addSession({
      subjectId: missed.subject_id,
      topicId: missed.topic_id,
      sessionDate: suggestion.sessionDate,
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
    });
    onResolved();
  }

  async function handleDismiss() {
    await updateSession(missed.id, { status: "rescheduled" });
    onResolved();
  }

  return (
    <div className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <p>
        <AlertTriangleIcon className="mr-1.5 inline size-4" />
        Missed: <strong>{missed.topics?.name ?? "Session"}</strong> on{" "}
        {formatShort(missed.session_date)}
        {suggestion && (
          <span className="text-muted-foreground">
            {" "}
            — suggest {formatShort(suggestion.sessionDate)} {suggestion.startTime.slice(0, 5)}
          </span>
        )}
      </p>
      <div className="flex gap-1.5">
        {suggestion && (
          <Button size="sm" className="h-7" onClick={handleAccept}>
            Accept
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7" onClick={handleDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function Timetable() {
  const { sessions, refresh } = useTimetable();
  const { subjects } = useSyllabusTree();
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(toDateStr(new Date()));

  const topicOptions = useMemo(() => flattenTopics(subjects === "loading" ? [] : subjects), [subjects]);
  const allSessions = sessions === "loading" ? EMPTY_SESSIONS : sessions;
  const missed = allSessions.filter((s) => s.status === "missed");

  function shift(delta: number) {
    if (view === "day") setAnchor(addDays(anchor, delta));
    else if (view === "week") setAnchor(addDays(anchor, delta * 7));
    else {
      const d = new Date(`${anchor}T00:00:00`);
      d.setMonth(d.getMonth() + delta);
      setAnchor(toDateStr(d));
    }
  }

  async function handleMarkComplete(session: TimetableSession) {
    await updateSession(session.id, { status: "completed" });
    refresh();
  }

  async function handleDelete(session: TimetableSession) {
    await deleteSession(session.id);
    refresh();
  }

  const daysInView = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    // month: every day from the 1st through the last day of the month
    const start = startOfMonth(anchor);
    const d = new Date(`${start}T00:00:00`);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TimetableSession[]>();
    for (const s of allSessions) {
      if (!map.has(s.session_date)) map.set(s.session_date, []);
      map.get(s.session_date)!.push(s);
    }
    return map;
  }, [allSessions]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground mt-1 text-sm">Plan when you'll study what.</p>
        </div>
        <div className="flex gap-2">
          <AutoSuggestDialog onSaved={refresh} />
          <AddSessionDialog
            topicOptions={topicOptions}
            defaultDate={anchor}
            existingSessions={allSessions}
            onAdded={refresh}
          />
        </div>
      </div>

      {missed.length > 0 && (
        <div className="flex flex-col gap-2">
          {missed.map((m) => (
            <MissedSessionBanner key={m.id} missed={m} allSessions={allSessions} onResolved={refresh} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarIcon className="size-4" /> {formatShort(anchor)}
          </span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="flex gap-1">
          {(["day", "week", "month"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "outline"}
              onClick={() => setView(v)}
              className="capitalize"
            >
              {v}
            </Button>
          ))}
        </div>
      </div>

      {sessions === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : view === "month" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {daysInView.map((date) => {
            const daySessions = sessionsByDate.get(date) ?? [];
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setAnchor(date);
                  setView("day");
                }}
                className="hover:border-primary/50 flex min-h-16 flex-col items-start gap-1 rounded-md border p-1.5 text-left"
              >
                <span className="text-muted-foreground text-xs">
                  {new Date(`${date}T00:00:00`).getDate()}
                </span>
                {daySessions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {daySessions.length}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={view === "week" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "flex flex-col gap-3"}>
          {daysInView.map((date) => {
            const daySessions = sessionsByDate.get(date) ?? [];
            return (
              <Card key={date}>
                <CardHeader>
                  <CardTitle className="text-sm">{formatShort(date)}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {daySessions.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No sessions</p>
                  ) : (
                    daySessions.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        topicOptions={topicOptions}
                        existingSessions={allSessions}
                        onMarkComplete={() => handleMarkComplete(s)}
                        onDelete={() => handleDelete(s)}
                        onChanged={refresh}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
