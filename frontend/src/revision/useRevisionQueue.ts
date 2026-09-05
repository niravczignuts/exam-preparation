import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import type { Question } from "@/pyq/usePyqQuestions";

export interface RevisionItem {
  id: string;
  question_id: string;
  added_reason: "wrong" | "skipped";
  interval_stage: 1 | 3 | 7;
  next_review_date: string;
  status: "pending" | "cleared";
  created_at: string;
  questions: Question;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useRevisionQueue() {
  const [items, setItems] = useState<RevisionItem[] | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("revision_queue_items")
      .select("*, questions(*, topics(name, subjects(name)))")
      .eq("status", "pending")
      .order("next_review_date");
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setItems(data as unknown as RevisionItem[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, error, refresh };
}

export function useClearedItems() {
  const [items, setItems] = useState<RevisionItem[] | "loading">("loading");

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("revision_queue_items")
      .select("*, questions(*, topics(name, subjects(name)))")
      .eq("status", "cleared")
      .order("created_at", { ascending: false });
    if (!error) setItems(data as unknown as RevisionItem[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, refresh };
}

export function isDue(item: RevisionItem): boolean {
  return item.next_review_date <= todayStr();
}

const NEXT_STAGE: Record<number, 3 | 7 | null> = { 1: 3, 3: 7, 7: null };

/** Advances a revision item through the 1 -> 3 -> 7 day spaced-repetition schedule on a
 * correct re-attempt, clearing it once it survives the final (7-day) interval; a wrong
 * re-attempt always resets it to the shortest interval (KAN-57, KAN-58). */
export async function reviewRevisionItem(
  item: RevisionItem,
  wasCorrect: boolean,
): Promise<{ error: string | null }> {
  if (!wasCorrect) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { error } = await supabase
      .from("revision_queue_items")
      .update({ interval_stage: 1, next_review_date: tomorrow.toISOString().slice(0, 10) })
      .eq("id", item.id);
    return { error: error?.message ?? null };
  }

  const nextStage = NEXT_STAGE[item.interval_stage];
  if (nextStage === null) {
    const { error } = await supabase
      .from("revision_queue_items")
      .update({ status: "cleared" })
      .eq("id", item.id);
    return { error: error?.message ?? null };
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextStage);
  const { error } = await supabase
    .from("revision_queue_items")
    .update({ interval_stage: nextStage, next_review_date: nextDate.toISOString().slice(0, 10) })
    .eq("id", item.id);
  return { error: error?.message ?? null };
}
