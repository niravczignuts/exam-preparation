import { useCallback, useEffect, useState } from "react";

import { getCurrentUserId, supabase } from "@/lib/supabaseClient";

export type SessionStatus = "scheduled" | "completed" | "missed" | "rescheduled";

export interface TimetableSession {
  id: string;
  timetable_id: string;
  subject_id: string | null;
  topic_id: string | null;
  session_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  status: SessionStatus;
  topics: { name: string; subjects: { name: string } | null } | null;
}

let timetableIdPromise: Promise<string> | null = null;

/** Every user gets exactly one timetable row, created lazily on first use — KAN-34
 * only asks for "a weekly study timetable" (singular), not multiple named ones. */
async function ensureTimetableId(): Promise<string> {
  if (!timetableIdPromise) {
    timetableIdPromise = (async () => {
      const userId = await getCurrentUserId();
      const { data: existing, error: selectError } = await supabase
        .from("timetables")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing.id as string;

      const { data: created, error: insertError } = await supabase
        .from("timetables")
        .insert({ user_id: userId, name: "My Timetable" })
        .select("id")
        .single();
      if (insertError) throw insertError;
      return created.id as string;
    })();
  }
  return timetableIdPromise;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function sessionsOverlap(a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }) {
  return toMinutes(a.start_time) < toMinutes(b.end_time) && toMinutes(b.start_time) < toMinutes(a.end_time);
}

export function useTimetable() {
  const [sessions, setSessions] = useState<TimetableSession[] | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const timetableId = await ensureTimetableId();
      const { data, error } = await supabase
        .from("timetable_sessions")
        .select("*, topics(name, subjects(name))")
        .eq("timetable_id", timetableId)
        .order("session_date")
        .order("start_time");
      if (error) throw error;

      const rows = data as unknown as TimetableSession[];

      // KAN-37: flag any scheduled session whose slot has already passed.
      const now = new Date();
      const overdue = rows.filter((s) => {
        if (s.status !== "scheduled") return false;
        return new Date(`${s.session_date}T${s.end_time}`) < now;
      });
      if (overdue.length > 0) {
        await supabase
          .from("timetable_sessions")
          .update({ status: "missed" })
          .in("id", overdue.map((s) => s.id));
        for (const s of overdue) s.status = "missed";
      }

      setError(null);
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timetable");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, error, refresh };
}

export async function addSession(input: {
  subjectId: string | null;
  topicId: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
}): Promise<{ error: string | null }> {
  const timetableId = await ensureTimetableId();
  const { error } = await supabase.from("timetable_sessions").insert({
    timetable_id: timetableId,
    subject_id: input.subjectId,
    topic_id: input.topicId,
    session_date: input.sessionDate,
    start_time: input.startTime,
    end_time: input.endTime,
  });
  return { error: error?.message ?? null };
}

export async function updateSession(
  id: string,
  fields: Partial<{
    subject_id: string | null;
    topic_id: string | null;
    session_date: string;
    start_time: string;
    end_time: string;
    status: SessionStatus;
  }>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("timetable_sessions").update(fields).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteSession(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("timetable_sessions").delete().eq("id", id);
  return { error: error?.message ?? null };
}
