import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

export interface ExamStage {
  id: string;
  name: string;
  exam_date: string; // YYYY-MM-DD
  exam_time: string; // HH:MM:SS
}

export function useExamStages() {
  const [stages, setStages] = useState<ExamStage[] | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("exam_stages")
      .select("id, name, exam_date, exam_time")
      .order("exam_date");

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setStages(data as ExamStage[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stages, error, refresh };
}

export async function addExamStage(
  name: string,
  examDate: string,
  examTime: string,
): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("exam_stages")
    .insert({ user_id: userData.user.id, name, exam_date: examDate, exam_time: examTime });
  return { error: error?.message ?? null };
}

export async function removeExamStage(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exam_stages").delete().eq("id", id);
  return { error: error?.message ?? null };
}
