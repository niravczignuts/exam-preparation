import type { Question } from "@/pyq/usePyqQuestions";

export interface MockTestSelection {
  questions: Question[];
  durationMinutes: number;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Selects questions for a full-length mock test from the Q&A bank (KAN-30).
 *
 * GSET Commerce's official paper structure isn't available to hardcode a fixed
 * question count/topic split, so this approximates its "objective, timed, full
 * syllabus coverage" pattern instead: only MCQ questions are eligible (GSET is
 * objective, and a timed auto-submit test needs auto-gradable answers), the
 * requested count is distributed across subjects proportional to how much
 * bank content each has (so a subject with more material gets proportionally
 * more questions, not an even split that would starve well-covered subjects),
 * and the time limit follows a fixed pace of 1.2 minutes/question typical of
 * objective competitive exams.
 */
export function selectMockTestQuestions(
  bank: Question[],
  requestedCount: number,
): { selection: MockTestSelection; error: null } | { selection: null; error: string } {
  const mcq = bank.filter((q) => q.options.length > 0);

  if (mcq.length < requestedCount) {
    return {
      selection: null,
      error: `Only ${mcq.length} multiple-choice question(s) available in your Q&A bank — need at least ${requestedCount}. Upload more PYQ papers or choose a smaller test size.`,
    };
  }

  const bySubject = new Map<string, Question[]>();
  for (const q of mcq) {
    const key = q.topics?.subjects?.name ?? "Untagged";
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key)!.push(q);
  }

  const subjectEntries = [...bySubject.entries()];
  const quotas = subjectEntries.map(([, qs]) => Math.floor((qs.length / mcq.length) * requestedCount));
  let assigned = quotas.reduce((a, b) => a + b, 0);

  // Rounding down leaves a few unassigned slots — hand them to the
  // largest-remaining subjects first so the total exactly matches requestedCount.
  const order = subjectEntries
    .map((_, i) => i)
    .sort((a, b) => subjectEntries[b][1].length - subjectEntries[a][1].length);
  let orderIndex = 0;
  while (assigned < requestedCount) {
    const i = order[orderIndex % order.length];
    if (quotas[i] < subjectEntries[i][1].length) {
      quotas[i] += 1;
      assigned += 1;
    }
    orderIndex += 1;
  }

  const selected: Question[] = [];
  subjectEntries.forEach(([, qs], i) => {
    selected.push(...shuffle(qs).slice(0, quotas[i]));
  });

  return {
    selection: { questions: shuffle(selected), durationMinutes: Math.round(requestedCount * 1.2) },
    error: null,
  };
}
