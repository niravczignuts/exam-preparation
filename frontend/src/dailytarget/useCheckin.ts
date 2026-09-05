import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export interface Checkin {
  id: string;
  daily_target_id: string;
  checkin_date: string;
  transcript: ChatMessage[];
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useTodaysCheckin() {
  const [checkin, setCheckin] = useState<Checkin | "loading" | null>("loading");

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("checkin_date", todayStr())
      .maybeSingle();
    if (error) {
      setCheckin(null);
      return;
    }
    setCheckin((data as Checkin | null) ?? null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { checkin, refresh };
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function startCheckin(
  dailyTargetId: string,
  language: "gu" | "en",
): Promise<{ checkinId: string; message: string }> {
  const response = await fetch(`${API_BASE}/chatbot/checkin/start`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ daily_target_id: dailyTargetId, language }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Check-in failed (${response.status})`);
  }
  const data = await response.json();
  return { checkinId: data.checkin_id, message: data.message };
}

export async function finishCheckin(params: {
  checkinId: string;
  status: "completed" | "partially_completed" | "missed";
  questionsSolved: number;
  recallAnswers: string;
  language: "gu" | "en";
}): Promise<{ message: string; currentStreak: number; longestStreak: number }> {
  const response = await fetch(`${API_BASE}/chatbot/checkin/finish`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({
      checkin_id: params.checkinId,
      status: params.status,
      questions_solved: params.questionsSolved,
      recall_answers: params.recallAnswers,
      language: params.language,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Check-in failed (${response.status})`);
  }
  const data = await response.json();
  return { message: data.message, currentStreak: data.current_streak, longestStreak: data.longest_streak };
}
