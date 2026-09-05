import { useCallback, useEffect, useState } from "react";

import { getCurrentUserId, supabase } from "@/lib/supabaseClient";

export interface Question {
  id: string;
  topic_id: string | null;
  pyq_upload_id: string | null;
  question_text: string;
  options: string[];
  correct_answer: string | null;
  explanation: string | null;
  exam_year: number | null;
  created_at: string;
  topics: { name: string; subjects: { name: string } | null } | null;
}

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[] | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("*, topics(name, subjects(name))")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setQuestions(data as unknown as Question[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { questions, error, refresh };
}

export async function updateQuestion(
  id: string,
  fields: Partial<
    Pick<Question, "question_text" | "options" | "correct_answer" | "explanation" | "topic_id">
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("questions").update(fields).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteQuestion(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("questions").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** Records a practice/mock-test attempt, and queues the question for spaced-repetition
 * revision when it's wrong or skipped (KAN-27, KAN-28). Revision Queue's own scheduling UI
 * (KAN-13) reads this same `revision_queue_items` table. */
export async function recordAttempt(params: {
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  wasSkipped: boolean;
  source?: "practice" | "mock_test";
  mockTestAttemptId?: string;
}): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from("question_attempts").insert({
    user_id: userId,
    question_id: params.questionId,
    selected_answer: params.selectedAnswer,
    is_correct: params.isCorrect,
    was_skipped: params.wasSkipped,
    source: params.source ?? "practice",
    mock_test_attempt_id: params.mockTestAttemptId ?? null,
  });
  if (error) return { error: error.message };

  if (params.wasSkipped || params.isCorrect === false) {
    const { error: queueError } = await queueForRevision(
      userId,
      params.questionId,
      params.wasSkipped ? "skipped" : "wrong",
    );
    if (queueError) return { error: queueError };
  }

  return { error: null };
}

/** Adds (or resets, if already pending — KAN-56's no-duplicates AC) a question to the
 * active revision queue at the shortest interval. A question already "cleared" gets a
 * fresh pending row instead of updating the cleared one, so the cleared attempt stays
 * in the archive (KAN-58's "re-add without losing history" AC). */
async function queueForRevision(
  userId: string,
  questionId: string,
  reason: "wrong" | "skipped",
): Promise<{ error: string | null }> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextReviewDate = tomorrow.toISOString().slice(0, 10);

  const { data: existing, error: findError } = await supabase
    .from("revision_queue_items")
    .select("id")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .eq("status", "pending")
    .maybeSingle();
  if (findError) return { error: findError.message };

  if (existing) {
    const { error } = await supabase
      .from("revision_queue_items")
      .update({ added_reason: reason, interval_stage: 1, next_review_date: nextReviewDate })
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("revision_queue_items").insert({
    user_id: userId,
    question_id: questionId,
    added_reason: reason,
    interval_stage: 1,
    next_review_date: nextReviewDate,
  });
  return { error: error?.message ?? null };
}
