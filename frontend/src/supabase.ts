import { createClient } from "@supabase/supabase-js";

// Anon key + URL — safe for the frontend, every request is scoped by the
// RLS policies in supabase/migrations (see 0001_core_schema.sql).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
