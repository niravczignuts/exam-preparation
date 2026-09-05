import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// Memoized like ensureAnonymousSession in supabaseClient.ts — every consumer
// (NavBar, DailyTarget, QuestionBank) shares one /health round-trip instead
// of each firing its own.
let cached: Promise<boolean> | null = null;

function fetchOpenaiConfigured(): Promise<boolean> {
  if (!cached) {
    cached = fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => Boolean(data?.openai_configured))
      .catch(() => false);
  }
  return cached;
}

/** Whether the backend has OPENAI_API_KEY configured — gates the doubt
 * assistant, Q&A search, and voice check-ins so the UI never shows a control
 * that would just error out (see docs/SETUP.md). Defaults to false (hidden)
 * until the check resolves. */
export function useAiFeaturesEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOpenaiConfigured().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}
