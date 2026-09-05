import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/**
 * The app has no login screen (see docs/SETUP.md, KAN-59..62) — every user is
 * anonymously authenticated so Supabase RLS policies scoped to `auth.uid()`
 * (settings, exam_stages, ...) have a real, stable identity to key off,
 * persisted by supabase-js like any other session. Requires "Allow anonymous
 * sign-ins" enabled in the Supabase project's Auth settings.
 */
let anonymousSessionPromise: Promise<void> | null = null;

/**
 * Memoized so concurrent callers share one in-flight sign-in instead of each
 * independently racing supabase.auth.signInAnonymously() — React 19's
 * StrictMode double-invokes effects in dev, so without this, two anonymous
 * users could get created back-to-back, and whichever component had already
 * captured the first (now-superseded) user id would send it in a later
 * write, failing RLS's `auth.uid() = user_id` check.
 */
export function ensureAnonymousSession(): Promise<void> {
  if (!anonymousSessionPromise) {
    anonymousSessionPromise = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return;

      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        anonymousSessionPromise = null; // allow a retry on the next call
        throw error;
      }
    })();
  }
  return anonymousSessionPromise;
}

export async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No authenticated user — ensureAnonymousSession() must run first.");
  return user.id;
}
