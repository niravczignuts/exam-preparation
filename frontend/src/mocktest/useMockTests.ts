import { useCallback, useEffect, useState } from "react";

import { getCurrentUserId, supabase } from "@/lib/supabaseClient";
import { recordAttempt, type Question } from "@/pyq/usePyqQuestions";
import type { MockTestSelection } from "./mockTestPattern";

export interface MockTestAttemptSummary {
  id: string;
  mock_test_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  correct_count: number | null;
  incorrect_count: number | null;
  skipped_count: number | null;
  mock_tests: { title: string; duration_minutes: number } | null;
}

export function useMockTestHistory() {
  const [attempts, setAttempts] = useState<MockTestAttemptSummary[] | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("mock_test_attempts")
      .select("*, mock_tests(title, duration_minutes)")
      .not("submitted_at", "is", null)
      .order("started_at", { ascending: false });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setAttempts(data as unknown as MockTestAttemptSummary[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { attempts, error, refresh };
}

/** Creates the mock_tests + mock_test_questions rows and an in-progress attempt
 * (KAN-30). Returns the attempt id to navigate the runner to. */
export async function createMockTestAttempt(
  selection: MockTestSelection,
): Promise<{ attemptId: string; error: null } | { attemptId: null; error: string }> {
  const userId = await getCurrentUserId();

  const { data: mockTest, error: testError } = await supabase
    .from("mock_tests")
    .insert({
      user_id: userId,
      title: `Mock Test — ${new Date().toLocaleDateString()}`,
      pattern_reference: "GSET Commerce (proportional subject coverage)",
      duration_minutes: selection.durationMinutes,
    })
    .select("id")
    .single();
  if (testError) return { attemptId: null, error: testError.message };

  const rows = selection.questions.map((q, i) => ({
    mock_test_id: mockTest.id,
    question_id: q.id,
    sort_order: i,
  }));
  const { error: linkError } = await supabase.from("mock_test_questions").insert(rows);
  if (linkError) return { attemptId: null, error: linkError.message };

  const { data: attempt, error: attemptError } = await supabase
    .from("mock_test_attempts")
    .insert({ user_id: userId, mock_test_id: mockTest.id })
    .select("id")
    .single();
  if (attemptError) return { attemptId: null, error: attemptError.message };

  return { attemptId: attempt.id, error: null };
}

export interface MockTestAttemptDetail {
  id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  correct_count: number | null;
  incorrect_count: number | null;
  skipped_count: number | null;
  mock_test: { title: string; duration_minutes: number };
  questions: Question[];
  answers: { question_id: string; selected_answer: string | null; is_correct: boolean | null }[];
}

export function useMockTestAttempt(attemptId: string | undefined) {
  const [detail, setDetail] = useState<MockTestAttemptDetail | "loading" | null>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!attemptId) return;
    const { data: attempt, error: attemptError } = await supabase
      .from("mock_test_attempts")
      .select("*, mock_tests(title, duration_minutes)")
      .eq("id", attemptId)
      .maybeSingle();
    if (attemptError) {
      setError(attemptError.message);
      return;
    }
    if (!attempt) {
      setDetail(null);
      return;
    }

    const { data: linkedQuestions, error: qError } = await supabase
      .from("mock_test_questions")
      .select("sort_order, questions(*, topics(name, subjects(name)))")
      .eq("mock_test_id", attempt.mock_test_id)
      .order("sort_order");
    if (qError) {
      setError(qError.message);
      return;
    }

    const { data: answers, error: aError } = await supabase
      .from("question_attempts")
      .select("question_id, selected_answer, is_correct")
      .eq("mock_test_attempt_id", attemptId);
    if (aError) {
      setError(aError.message);
      return;
    }

    setError(null);
    setDetail({
      id: attempt.id,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      score: attempt.score,
      correct_count: attempt.correct_count,
      incorrect_count: attempt.incorrect_count,
      skipped_count: attempt.skipped_count,
      mock_test: attempt.mock_tests,
      questions: (linkedQuestions as unknown as { questions: Question }[]).map((r) => r.questions),
      answers: answers as unknown as MockTestAttemptDetail["answers"],
    });
  }, [attemptId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { detail, error, refresh };
}

/** Grades and closes out an in-progress attempt (KAN-31 auto-submit / manual submit,
 * KAN-32 score report). Non-MCQ questions can't appear here (mock tests are MCQ-only —
 * see mockTestPattern.ts) so every answer is objectively gradable. */
export async function submitMockTestAttempt(
  attemptId: string,
  questions: Question[],
  answers: Record<string, string | null>,
): Promise<{ error: string | null }> {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  for (const question of questions) {
    const selected = answers[question.id] ?? null;
    const wasSkipped = selected == null;
    const isCorrect = wasSkipped
      ? null
      : selected.trim() === (question.correct_answer ?? "").trim();

    if (wasSkipped) skipped += 1;
    else if (isCorrect) correct += 1;
    else incorrect += 1;

    await recordAttempt({
      questionId: question.id,
      selectedAnswer: selected,
      isCorrect,
      wasSkipped,
      source: "mock_test",
      mockTestAttemptId: attemptId,
    });
  }

  const score = questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
  const { error } = await supabase
    .from("mock_test_attempts")
    .update({
      submitted_at: new Date().toISOString(),
      score,
      correct_count: correct,
      incorrect_count: incorrect,
      skipped_count: skipped,
    })
    .eq("id", attemptId);

  return { error: error?.message ?? null };
}
