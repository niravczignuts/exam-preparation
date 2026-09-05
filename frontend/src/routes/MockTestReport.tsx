import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { CheckIcon, ClockIcon, XIcon } from "lucide-react";

import { useMockTestAttempt } from "@/mocktest/useMockTests";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function formatDuration(startedAt: string, submittedAt: string): string {
  const ms = new Date(submittedAt).getTime() - new Date(startedAt).getTime();
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function MockTestReport() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { detail } = useMockTestAttempt(attemptId);

  const topicBreakdown = useMemo(() => {
    if (!detail || detail === "loading") return [];
    const answersByQuestion = new Map(detail.answers.map((a) => [a.question_id, a]));
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const q of detail.questions) {
      const key = q.topics ? `${q.topics.subjects?.name} — ${q.topics.name}` : "Untagged";
      const entry = byTopic.get(key) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answersByQuestion.get(q.id)?.is_correct) entry.correct += 1;
      byTopic.set(key, entry);
    }
    return [...byTopic.entries()].map(([topic, { correct, total }]) => ({
      topic,
      correct,
      total,
      percent: Math.round((correct / total) * 100),
    }));
  }, [detail]);

  if (!detail || detail === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (!detail.submitted_at) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-muted-foreground text-sm">This test hasn't been submitted yet.</p>
      </main>
    );
  }

  const answersByQuestion = new Map(detail.answers.map((a) => [a.question_id, a]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{detail.mock_test.title}</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <ClockIcon className="size-4" /> {formatDuration(detail.started_at, detail.submitted_at)} ·{" "}
          {new Date(detail.started_at).toLocaleDateString()}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Progress value={detail.score ?? 0} />
            <span className="w-14 shrink-0 text-right text-lg font-bold">{detail.score}%</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-success font-medium">{detail.correct_count} correct</span>
            <span className="text-destructive font-medium">{detail.incorrect_count} incorrect</span>
            <span className="text-muted-foreground font-medium">{detail.skipped_count} skipped</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic-wise performance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {topicBreakdown.map((t) => (
            <div key={t.topic} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate">{t.topic}</span>
              <Progress value={t.percent} className="flex-1" />
              <span className="text-muted-foreground w-16 shrink-0 text-right tabular-nums">
                {t.correct}/{t.total}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Review</h2>
        {detail.questions.map((q, i) => {
          const answer = answersByQuestion.get(q.id);
          return (
            <Card key={q.id} className="gap-2 py-3">
              <CardContent className="flex flex-col gap-1.5 text-sm">
                <p className="font-medium">
                  {i + 1}. {q.question_text}
                </p>
                <div className="flex items-center gap-1.5">
                  {answer?.is_correct ? (
                    <Badge variant="success">
                      <CheckIcon /> Correct
                    </Badge>
                  ) : answer?.selected_answer ? (
                    <Badge variant="destructive">
                      <XIcon /> Incorrect
                    </Badge>
                  ) : (
                    <Badge variant="outline">Skipped</Badge>
                  )}
                  {answer?.selected_answer && !answer.is_correct && (
                    <span className="text-muted-foreground">Your answer: {answer.selected_answer}</span>
                  )}
                </div>
                {q.correct_answer && (
                  <p className="text-muted-foreground">Correct answer: {q.correct_answer}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
