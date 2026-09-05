import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type TopicStatus = "not_started" | "in_progress" | "completed" | "revision_needed";

export const TOPIC_STATUSES: TopicStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "revision_needed",
];

interface TopicRow {
  id: string;
  subject_id: string;
  parent_topic_id: string | null;
  name: string;
  status: TopicStatus;
  sort_order: number;
}

interface SubjectRow {
  id: string;
  name: string;
  sort_order: number;
  topics: TopicRow[];
}

export interface TopicNode extends TopicRow {
  subtopics: TopicNode[];
}

export interface SubjectNode {
  id: string;
  name: string;
  sort_order: number;
  topics: TopicNode[];
  totalTopics: number;
  completedTopics: number;
  revisionNeededTopics: number;
  completionPercent: number;
}

function buildSubjectNode(subject: SubjectRow): SubjectNode {
  const byParent = new Map<string | null, TopicRow[]>();
  for (const topic of subject.topics) {
    const list = byParent.get(topic.parent_topic_id) ?? [];
    list.push(topic);
    byParent.set(topic.parent_topic_id, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const toNode = (topic: TopicRow): TopicNode => ({
    ...topic,
    subtopics: (byParent.get(topic.id) ?? []).map(toNode),
  });

  const total = subject.topics.length;
  const completed = subject.topics.filter((t) => t.status === "completed").length;
  const revisionNeeded = subject.topics.filter((t) => t.status === "revision_needed").length;

  return {
    id: subject.id,
    name: subject.name,
    sort_order: subject.sort_order,
    topics: (byParent.get(null) ?? []).map(toNode),
    totalTopics: total,
    completedTopics: completed,
    revisionNeededTopics: revisionNeeded,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function useSyllabusTree() {
  const [subjects, setSubjects] = useState<SubjectNode[] | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select(
        "id, name, sort_order, topics(id, subject_id, parent_topic_id, name, status, sort_order)",
      )
      .order("sort_order");

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setSubjects((data as SubjectRow[]).map(buildSubjectNode));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const overallPercent = useMemo(() => {
    if (subjects === "loading") return 0;
    const total = subjects.reduce((sum, s) => sum + s.totalTopics, 0);
    const completed = subjects.reduce((sum, s) => sum + s.completedTopics, 0);
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [subjects]);

  return { subjects, error, overallPercent, refresh };
}

// ---------------------------------------------------------------------------
// Mutations (KAN-18, KAN-20, KAN-21) — direct-to-Supabase, RLS-scoped.
// ---------------------------------------------------------------------------

export async function addSubject(name: string): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("subjects")
    .insert({ user_id: userData.user.id, name, sort_order: Date.now() });
  return { error: error?.message ?? null };
}

export async function renameSubject(id: string, name: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("subjects").update({ name }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteSubject(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function addTopic(
  subjectId: string,
  parentTopicId: string | null,
  name: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("topics").insert({
    subject_id: subjectId,
    parent_topic_id: parentTopicId,
    name,
    sort_order: Date.now(),
  });
  return { error: error?.message ?? null };
}

export async function renameTopic(id: string, name: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("topics").update({ name }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteTopic(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("topics").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function setTopicStatus(
  id: string,
  status: TopicStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("topics")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error?.message ?? null };
}

/** Swaps sort_order with the sibling in the given direction. */
export async function reorderTopic(
  siblings: TopicNode[],
  id: string,
  direction: "up" | "down",
): Promise<{ error: string | null }> {
  const index = siblings.findIndex((t) => t.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= siblings.length) return { error: null };

  const a = siblings[index];
  const b = siblings[swapWith];
  const [{ error: errA }, { error: errB }] = await Promise.all([
    supabase.from("topics").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("topics").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  return { error: errA?.message ?? errB?.message ?? null };
}
