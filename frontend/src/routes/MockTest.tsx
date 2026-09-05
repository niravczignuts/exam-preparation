import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { useQuestions } from "@/pyq/usePyqQuestions";
import { selectMockTestQuestions } from "@/mocktest/mockTestPattern";
import { ScoreTrendChart } from "@/mocktest/ScoreTrendChart";
import { createMockTestAttempt, useMockTestHistory } from "@/mocktest/useMockTests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function GenerateMockTestDialog() {
  const { questions } = useQuestions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(50);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (questions === "loading") return;
    setGenerating(true);
    const { selection, error } = selectMockTestQuestions(questions, count);
    if (error || !selection) {
      toast.error(error ?? "Could not build a mock test");
      setGenerating(false);
      return;
    }
    const { attemptId, error: createError } = await createMockTestAttempt(selection);
    setGenerating(false);
    if (createError || !attemptId) {
      toast.error(createError ?? "Failed to create mock test");
      return;
    }
    setOpen(false);
    navigate(`/mock-test/${attemptId}/run`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Generate mock test
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a full-length mock test</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Selects MCQ questions from your Q&amp;A bank proportional to each subject's
            coverage, mimicking a full GSET Commerce-style objective paper.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mt-count">Number of questions</Label>
            <Input
              id="mt-count"
              type="number"
              min={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 10)}
              className="w-24"
            />
            <p className="text-muted-foreground text-xs">≈{Math.round(count * 1.2)} minute time limit</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleGenerate} disabled={generating}>
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MockTest() {
  const { attempts } = useMockTestHistory();

  const trendPoints = useMemo(() => {
    if (attempts === "loading") return [];
    return [...attempts]
      .reverse()
      .map((a) => ({
        date: new Date(a.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        score: a.score ?? 0,
      }));
  }, [attempts]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mock Tests</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Full-length timed tests generated from your Q&amp;A bank.
          </p>
        </div>
        <GenerateMockTestDialog />
      </div>

      {attempts === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : attempts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No mock tests yet — generate one above once you have some questions in your{" "}
            <Link to="/pyq" className="text-primary underline underline-offset-4">
              Q&amp;A bank
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <>
          {trendPoints.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreTrendChart points={trendPoints} />
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            {attempts.map((a) => (
              <Link key={a.id} to={`/mock-test/${a.id}/report`}>
                <Card className="hover:border-primary/40 gap-2 py-3 transition-colors">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="text-muted-foreground size-4" />
                      <div>
                        <p className="text-sm font-medium">{a.mock_tests?.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(a.started_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={a.score != null && a.score >= 50 ? "success" : "warning"}>
                      {a.score}%
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
