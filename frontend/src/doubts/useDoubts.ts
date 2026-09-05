import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export interface DoubtThread {
  id: string;
  topic_id: string | null;
  title: string;
  created_at: string;
}

export interface DoubtMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function useDoubtThreads() {
  const [threads, setThreads] = useState<DoubtThread[] | "loading">("loading");

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("doubt_threads")
      .select("*")
      .order("created_at", { ascending: false });
    setThreads(error ? [] : (data as DoubtThread[]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { threads, refresh };
}

export function useDoubtMessages(threadId: string | null) {
  const [messages, setMessages] = useState<DoubtMessage[] | "loading">("loading");

  const refresh = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    const { data, error } = await supabase
      .from("doubt_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    setMessages(error ? [] : (data as DoubtMessage[]));
  }, [threadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { messages, refresh };
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function askDoubt(params: {
  threadId: string | null;
  topicId?: string | null;
  message: string;
  language: "gu" | "en";
}): Promise<{ threadId: string; reply: string }> {
  const response = await fetch(`${API_BASE}/doubts/ask`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({
      thread_id: params.threadId,
      topic_id: params.topicId ?? null,
      message: params.message,
      language: params.language,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Could not get a reply (${response.status})`);
  }
  const data = await response.json();
  return { threadId: data.thread_id, reply: data.reply };
}
