import type { SubjectNode, TopicNode } from "@/syllabus/useSyllabusTree";

export interface ProposedSession {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
}

interface RemainingTopic {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  priority: number; // lower = scheduled sooner
}

function collectRemaining(subjects: SubjectNode[]): RemainingTopic[] {
  const out: RemainingTopic[] = [];
  const priorityOf = { revision_needed: 0, in_progress: 1, not_started: 2 } as const;

  function walk(topics: TopicNode[], subjectId: string, subjectName: string) {
    for (const topic of topics) {
      if (topic.status !== "completed") {
        out.push({
          subjectId,
          subjectName,
          topicId: topic.id,
          topicName: topic.name,
          priority: priorityOf[topic.status as keyof typeof priorityOf] ?? 2,
        });
      }
      if (topic.subtopics.length) walk(topic.subtopics, subjectId, subjectName);
    }
  }
  for (const subject of subjects) walk(subject.topics, subject.id, subject.name);
  return out.sort((a, b) => a.priority - b.priority);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** KAN-35: proposes a session per remaining (non-completed) topic, spread evenly across
 * the days left until `examDate`, most urgent (revision-needed, then in-progress, then
 * not-started) topics scheduled first. Pure/deterministic so re-running it after
 * progress changes (topics get marked completed) naturally reflects the new remaining
 * set — nothing here is persisted until the caller saves the accepted sessions. */
export function suggestTimetable(
  subjects: SubjectNode[],
  examDate: string,
  opts: { sessionMinutes?: number; dayStartTime?: string; breakMinutes?: number } = {},
): { sessions: ProposedSession[]; error: string | null } {
  const sessionMinutes = opts.sessionMinutes ?? 60;
  const dayStartTime = opts.dayStartTime ?? "09:00:00";
  const breakMinutes = opts.breakMinutes ?? 15;

  const today = new Date().toISOString().slice(0, 10);
  const startDate = addDays(today, 1);
  const daysLeft = Math.round(
    (new Date(`${examDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) /
      (24 * 60 * 60 * 1000),
  ) + 1;

  if (daysLeft < 1) {
    return { sessions: [], error: "The exam date has to be at least a day from now to plan a timetable." };
  }

  const remaining = collectRemaining(subjects);
  if (remaining.length === 0) {
    return { sessions: [], error: "No remaining topics — your syllabus is fully complete!" };
  }

  const sessionsPerDay = Math.max(1, Math.ceil(remaining.length / daysLeft));
  const sessions: ProposedSession[] = [];

  remaining.forEach((topic, index) => {
    const dayIndex = Math.floor(index / sessionsPerDay);
    const slotIndex = index % sessionsPerDay;
    const sessionDate = addDays(startDate, dayIndex);
    const startTime = addMinutes(dayStartTime, slotIndex * (sessionMinutes + breakMinutes));
    const endTime = addMinutes(startTime, sessionMinutes);
    sessions.push({
      subjectId: topic.subjectId,
      subjectName: topic.subjectName,
      topicId: topic.topicId,
      topicName: topic.topicName,
      sessionDate,
      startTime,
      endTime,
    });
  });

  return { sessions, error: null };
}
