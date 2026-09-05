import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, ClockIcon, RotateCcwIcon, SkipForwardIcon, XIcon } from "lucide-react";

import { recordAttempt, useQuestions, type Question } from "@/pyq/usePyqQuestions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const QUESTION_SECONDS = 60;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface Attempt {
  question: Question;
  isCorrect: boolean | null;
  wasSkipped: boolean;
}

function Runner({
  questions,
  timed,
  onFinish,
}: {
  questions: Question[];
  timed: boolean;
  onFinish: (attempts: Attempt[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [freeAnswer, setFreeAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const question = questions[index];
  const isMcq = question.options.length > 0;

  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setFreeAnswer("");
    setSecondsLeft(QUESTION_SECONDS);
  }, [index]);

  useEffect(() => {
    if (!timed || revealed) return;
    if (secondsLeft <= 0) {
      handleSkip();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, revealed, secondsLeft]);

  function advance(attempt: Attempt) {
    void recordAttempt({
      questionId: attempt.question.id,
      selectedAnswer: isMcq ? selected : freeAnswer || null,
      isCorrect: attempt.isCorrect,
      wasSkipped: attempt.wasSkipped,
    });
    const next = [...attempts, attempt];
    setAttempts(next);
    if (index + 1 >= questions.length) {
      onFinish(next);
    } else {
      setIndex(index + 1);
    }
  }

  function handleSkip() {
    advance({ question, isCorrect: null, wasSkipped: true });
  }

  function handleSelectOption(option: string) {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
  }

  function handleRevealFreeform() {
    setRevealed(true);
  }

  function handleSelfGrade(isCorrect: boolean) {
    advance({ question, isCorrect, wasSkipped: false });
  }

  const isSelectedCorrect =
    isMcq && selected != null && question.correct_answer != null
      ? selected.trim() === question.correct_answer.trim()
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Question {index + 1} of {questions.length}
        </p>
        {timed && !revealed && (
          <Badge variant={secondsLeft <= 10 ? "destructive" : "outline"}>
            <ClockIcon /> {secondsLeft}s
          </Badge>
        )}
      </div>
      <Progress value={((index + (revealed ? 1 : 0)) / questions.length) * 100} />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="font-medium">{question.question_text}</p>

          {isMcq ? (
            <div className="flex flex-col gap-2">
              {question.options.map((option) => {
                const isThisCorrect = revealed && option.trim() === question.correct_answer?.trim();
                const isThisSelected = option === selected;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    disabled={revealed}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      isThisCorrect
                        ? "border-success bg-success/10"
                        : isThisSelected
                          ? "border-destructive bg-destructive/10"
                          : "hover:bg-accent/50"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Type your answer, then reveal the model answer to self-grade…"
                value={freeAnswer}
                onChange={(e) => setFreeAnswer(e.target.value)}
                disabled={revealed}
              />
              {!revealed && (
                <Button size="sm" className="w-fit" onClick={handleRevealFreeform}>
                  Reveal answer
                </Button>
              )}
            </div>
          )}

          {revealed && (
            <div className="bg-muted/50 flex flex-col gap-1 rounded-md p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                {isMcq && isSelectedCorrect != null ? (
                  isSelectedCorrect ? (
                    <>
                      <CheckIcon className="text-success size-4" /> Correct
                    </>
                  ) : (
                    <>
                      <XIcon className="text-destructive size-4" /> Incorrect
                    </>
                  )
                ) : (
                  "Model answer"
                )}
              </p>
              {question.correct_answer && <p>{question.correct_answer}</p>}
              {question.explanation && (
                <p className="text-muted-foreground">{question.explanation}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={handleSkip} disabled={revealed}>
          <SkipForwardIcon /> Skip
        </Button>
        {revealed && !isMcq ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSelfGrade(false)}>
              <XIcon /> I got it wrong
            </Button>
            <Button size="sm" onClick={() => handleSelfGrade(true)}>
              <CheckIcon /> I got it right
            </Button>
          </div>
        ) : revealed ? (
          <Button size="sm" onClick={() => advance({ question, isCorrect: isSelectedCorrect, wasSkipped: false })}>
            {index + 1 >= questions.length ? "Finish" : "Next question"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Summary({ attempts, onRestart }: { attempts: Attempt[]; onRestart: () => void }) {
  const correct = attempts.filter((a) => a.isCorrect === true).length;
  const wrong = attempts.filter((a) => a.isCorrect === false).length;
  const skipped = attempts.filter((a) => a.wasSkipped).length;
  const scored = correct + wrong;
  const percent = scored === 0 ? 0 : Math.round((correct / scored) * 100);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Session complete</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Progress value={percent} />
            <span className="w-12 shrink-0 text-right text-sm font-semibold">{percent}%</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-success font-medium">{correct} correct</span>
            <span className="text-destructive font-medium">{wrong} wrong</span>
            <span className="text-muted-foreground font-medium">{skipped} skipped</span>
          </div>
        </CardContent>
      </Card>

      {attempts
        .filter((a) => a.isCorrect === false || a.wasSkipped)
        .map((a) => (
          <Card key={a.question.id} className="border-destructive/30">
            <CardContent className="flex flex-col gap-1 text-sm">
              <p className="font-medium">{a.question.question_text}</p>
              {a.question.correct_answer && (
                <p className="text-muted-foreground">Answer: {a.question.correct_answer}</p>
              )}
              <Badge variant="warning" className="w-fit">
                Added to revision queue
              </Badge>
            </CardContent>
          </Card>
        ))}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcwIcon /> Practice again
        </Button>
        <Button asChild variant="ghost">
          <Link to="/pyq">Back to Q&amp;A bank</Link>
        </Button>
      </div>
    </div>
  );
}

export function Practice() {
  const { questions } = useQuestions();
  const [session, setSession] = useState<Question[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(false);

  const pool = useMemo(() => (questions === "loading" ? [] : questions), [questions]);

  function handleStart() {
    setAttempts(null);
    setSession(shuffle(pool).slice(0, Math.min(count, pool.length)));
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Practice</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Timed or untimed quiz mode over your Q&amp;A bank.
        </p>
      </div>

      {attempts ? (
        <Summary attempts={attempts} onRestart={() => setAttempts(null)} />
      ) : session ? (
        <Runner questions={session} timed={timed} onFinish={setAttempts} />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            {questions !== "loading" && questions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No questions yet —{" "}
                <Link to="/pyq" className="text-primary underline underline-offset-4">
                  upload a PYQ paper
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="q-count">Number of questions</Label>
                  <Input
                    id="q-count"
                    type="number"
                    min={1}
                    max={pool.length || 1}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 1)}
                    className="w-24"
                  />
                  <p className="text-muted-foreground text-xs">{pool.length} available</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="timed-toggle">Timed (60s per question)</Label>
                  <Switch id="timed-toggle" checked={timed} onCheckedChange={setTimed} />
                </div>
                <Button onClick={handleStart} disabled={pool.length === 0}>
                  Start practice
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
