import { useEffect, useState } from "react";

import { getCurrentUserId, supabase } from "@/lib/supabaseClient";
import type { DailyTargetStatus } from "@/dailytarget/useDailyTarget";

export interface DayRecord {
  date: string;
  status: DailyTargetStatus;
}

/** KAN-54: last `weeks` weeks of daily_targets, for a completed/partial/missed
 * calendar heatmap and a completion-rate percentage. */
export function useDailyTargetHistory(weeks = 12) {
  const [days, setDays] = useState<DayRecord[] | "loading">("loading");

  useEffect(() => {
    (async () => {
      const userId = await getCurrentUserId();
      const start = new Date();
      start.setDate(start.getDate() - weeks * 7);
      const { data } = await supabase
        .from("daily_targets")
        .select("target_date, status")
        .eq("user_id", userId)
        .gte("target_date", start.toISOString().slice(0, 10))
        .order("target_date");
      setDays((data ?? []).map((r) => ({ date: r.target_date, status: r.status })));
    })();
  }, [weeks]);

  return days;
}

export interface WeakTopic {
  topicId: string;
  subjectName: string;
  topicName: string;
  correct: number;
  total: number;
  accuracy: number;
}

const WEAK_THRESHOLD = 0.6;
const MIN_ATTEMPTS = 3;

/** KAN-55: per-topic accuracy across every recorded practice + mock-test answer
 * (question_attempts already carries both via its `source` column), surfaced as
 * "weak" once there's enough signal (>= MIN_ATTEMPTS) and accuracy is low. */
export function useWeakTopics() {
  const [topics, setTopics] = useState<WeakTopic[] | "loading">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("question_attempts")
        .select("is_correct, was_skipped, questions(topic_id, topics(name, subjects(name)))");

      const byTopic = new Map<string, WeakTopic>();
      for (const row of (data ?? []) as unknown as {
        is_correct: boolean | null;
        was_skipped: boolean;
        questions: { topic_id: string | null; topics: { name: string; subjects: { name: string } | null } | null } | null;
      }[]) {
        const topicId = row.questions?.topic_id;
        if (!topicId || row.was_skipped) continue;
        const entry = byTopic.get(topicId) ?? {
          topicId,
          subjectName: row.questions?.topics?.subjects?.name ?? "Untagged",
          topicName: row.questions?.topics?.name ?? "Untagged",
          correct: 0,
          total: 0,
          accuracy: 0,
        };
        entry.total += 1;
        if (row.is_correct) entry.correct += 1;
        byTopic.set(topicId, entry);
      }

      const weak = [...byTopic.values()]
        .map((t) => ({ ...t, accuracy: t.correct / t.total }))
        .filter((t) => t.total >= MIN_ATTEMPTS && t.accuracy < WEAK_THRESHOLD)
        .sort((a, b) => a.accuracy - b.accuracy);

      setTopics(weak);
    })();
  }, []);

  return topics;
}
