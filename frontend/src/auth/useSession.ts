import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";

/** `"loading"` until the initial session check resolves, then the session
 * (or `null` if signed out) — kept live via onAuthStateChange. */
export function useSession(): Session | null | "loading" {
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  return session;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
