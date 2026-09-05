import { useCallback, useEffect, useState } from "react";
import { getCurrentUserId, supabase } from "../lib/supabaseClient";
import { onWritesFlushed, queueWrite, registerReplayHandler } from "../lib/offlineQueue";

export interface ExamStage {
  id: string;
  user_id: string;
  name: string;
  exam_date: string;
  exam_time: string;
}

registerReplayHandler("exam-stage-insert", async (payload) => {
  const row = payload as Omit<ExamStage, "id">;
  const { error } = await supabase.from("exam_stages").insert(row);
  if (error) throw error;
});

registerReplayHandler("exam-stage-delete", async (payload) => {
  const { id } = payload as { id: string };
  const { error } = await supabase.from("exam_stages").delete().eq("id", id);
  if (error) throw error;
});

function sortByDate(stages: ExamStage[]): ExamStage[] {
  return [...stages].sort((a, b) => a.exam_date.localeCompare(b.exam_date));
}

export function useExamStages() {
  const [stages, setStages] = useState<ExamStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "offline">("idle");

  const reload = useCallback(async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("exam_stages")
      .select("*")
      .eq("user_id", userId)
      .order("exam_date");
    if (error) throw error;
    setStages((data as ExamStage[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => onWritesFlushed(() => void reload()), [reload]);

  const addStage = useCallback(async (name: string, examDate: string) => {
    const userId = await getCurrentUserId();
    const row = { user_id: userId, name, exam_date: examDate };
    try {
      const { data, error } = await supabase.from("exam_stages").insert(row).select().single();
      if (error) throw error;
      setStages((prev) => sortByDate([...prev, data as ExamStage]));
      setSaveState("saved");
    } catch {
      queueWrite("exam-stage-insert", row);
      setSaveState("offline");
      setStages((prev) =>
        sortByDate([
          ...prev,
          { id: `pending-${crypto.randomUUID()}`, exam_time: "09:00:00", ...row },
        ]),
      );
    }
  }, []);

  const deleteStage = useCallback(async (id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
    if (id.startsWith("pending-")) return; // never made it to the server — nothing to delete remotely
    try {
      const { error } = await supabase.from("exam_stages").delete().eq("id", id);
      if (error) throw error;
      setSaveState("saved");
    } catch {
      queueWrite("exam-stage-delete", { id });
      setSaveState("offline");
    }
  }, []);

  return { stages, loading, saveState, addStage, deleteStage, reload };
}
