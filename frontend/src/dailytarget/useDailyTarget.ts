import { useCallback, useEffect, useState } from "react";

import { getCurrentUserId, supabase } from "@/lib/supabaseClient";

export type DailyTargetStatus =
  | "proposed"
  | "accepted"
  | "completed"
  | "partially_completed"
  | "missed";

export interface DailyTarget {
  id: string;
  target_date: string;
  description: string;
  status: DailyTargetStatus;
  generated_by: "system" | "user";
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useTodaysTarget() {
  const [target, setTarget] = useState<DailyTarget | "loading" | null>("loading");

  const refresh = useCallback(async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("daily_targets")
      .select("*")
      .eq("user_id", userId)
      .eq("target_date", todayStr())
      .maybeSingle();
    if (error) {
      setTarget(null);
      return;
    }
    setTarget((data as DailyTarget | null) ?? null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { target, refresh };
}

export async function createTodaysTarget(description: string): Promise<{ id: string | null; error: string | null }> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("daily_targets")
    .insert({
      user_id: userId,
      target_date: todayStr(),
      description,
      status: "accepted",
      generated_by: "user",
    })
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function updateTarget(
  id: string,
  fields: Partial<{ description: string; status: DailyTargetStatus }>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("daily_targets").update(fields).eq("id", id);
  return { error: error?.message ?? null };
}

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

export function useStreak() {
  const [streak, setStreak] = useState<Streak | "loading">("loading");

  const refresh = useCallback(async () => {
    const userId = await getCurrentUserId();
    const { data } = await supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle();
    setStreak((data as Streak | null) ?? { current_streak: 0, longest_streak: 0, last_active_date: null });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { streak, refresh };
}

/** KAN-41: X of 7 days completed this week (last 7 calendar days including today). */
export function useWeeklyCompletion() {
  const [completed, setCompleted] = useState<number | "loading">("loading");

  useEffect(() => {
    (async () => {
      const userId = await getCurrentUserId();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const { data } = await supabase
        .from("daily_targets")
        .select("status")
        .eq("user_id", userId)
        .gte("target_date", weekAgo.toISOString().slice(0, 10))
        .lte("target_date", todayStr());
      setCompleted((data ?? []).filter((r) => r.status === "completed").length);
    })();
  }, []);

  return completed;
}
