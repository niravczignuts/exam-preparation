import { supabase } from "@/lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface SearchAndIngestResult {
  sources_tried: number;
  sources_ingested: number;
  sources_failed: number;
  questions_added: number;
  duplicates_flagged: number;
  subjects_added: number;
  topics_added: number;
  exam_stage_created: boolean;
}

export async function searchAndIngest(params: {
  query: string;
  kind: "syllabus" | "pyq";
  examYear?: number;
}): Promise<SearchAndIngestResult> {
  const response = await fetch(`${API_BASE}/materials/search-and-ingest`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({
      query: params.query,
      kind: params.kind,
      exam_year: params.examYear ?? null,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Search failed (${response.status})`);
  }
  return response.json();
}
