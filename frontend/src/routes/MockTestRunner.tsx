import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ClockIcon, FlagIcon } from "lucide-react";
import { toast } from "sonner";

import { useMockTestAttempt, submitMockTestAttempt } from "@/mocktest/useMockTests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MockTestRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { detail } = useMockTestAttempt(attemptId);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (detail && detail !== "loading" && secondsLeft === null) {
      setSecondsLeft(detail.mock_test.duration_minutes * 60);
    }
  }, [detail, secondsLeft]);

  async function handleSubmit() {
    if (!detail || detail === "loading" || submitted || !attemptId) return;
    setSubmitted(true);
    setSubmitting(true);
    const { error } = await submitMockTestAttempt(attemptId, detail.questions, answers);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      setSubmitted(false);
      return;
    }
    navigate(`/mock-test/${attemptId}/report`, { replace: true });
  }

  useEffect(() => {
    if (secondsLeft === null || submitted) return;
    if (secondsLeft <= 0) {
      toast.info("Time's up — submitting your test");
      void handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted]);

  if (!detail || detail === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (detail.submitted_at) {
    return <Navigate to={`/mock-test/${attemptId}/report`} replace />;
  }

  const question = detail.questions[index];
  const minutes = secondsLeft != null ? Math.floor(secondsLeft / 60) : 0;
  const seconds = secondsLeft != null ? secondsLeft % 60 : 0;

  function toggleFlag() {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  }

  const answeredCount = Object.values(answers).filter((a) => a != null).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Question {index + 1} of {detail.questions.length} · {answeredCount} answered
        </p>
        <Badge variant={secondsLeft != null && secondsLeft <= 60 ? "destructive" : "outline"}>
          <ClockIcon /> {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {detail.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`flex size-7 items-center justify-center rounded-md border text-xs font-medium ${
              i === index
                ? "border-primary bg-primary text-primary-foreground"
                : answers[q.id] != null
                  ? "border-success/40 bg-success/10"
                  : flagged.has(q.id)
                    ? "border-warning/40 bg-warning/10"
                    : "hover:bg-accent/50"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{question.question_text}</p>
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${flagged.has(question.id) ? "text-warning" : "text-muted-foreground"}`}
              onClick={toggleFlag}
              aria-label="Mark for review"
            >
              <FlagIcon className="size-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  answers[question.id] === option ? "border-primary bg-primary/10" : "hover:bg-accent/50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={index >= detail.questions.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next
          </Button>
        </div>
        <Button size="sm" onClick={() => handleSubmit()} disabled={submitting}>
          Submit test
        </Button>
      </div>
    </main>
  );
}
