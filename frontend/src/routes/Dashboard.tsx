import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FlameIcon, TargetIcon, TrendingUpIcon, TriangleAlertIcon, TrophyIcon } from "lucide-react";

import { useStreak, useWeeklyCompletion } from "@/dailytarget/useDailyTarget";
import { useDailyTargetHistory, useWeakTopics } from "@/dashboard/useDashboardData";
import { StreakHeatmap } from "@/dashboard/StreakHeatmap";
import { ScoreTrendChart } from "@/mocktest/ScoreTrendChart";
import { useMockTestHistory } from "@/mocktest/useMockTests";
import { useSyllabusTree } from "@/syllabus/useSyllabusTree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard() {
  const { subjects, overallPercent } = useSyllabusTree();
  const { attempts } = useMockTestHistory();
  const { streak } = useStreak();
  const weeklyCompleted = useWeeklyCompletion();
  const days = useDailyTargetHistory(12);
  const weakTopics = useWeakTopics();

  const completionRate30d = useMemo(() => {
    if (days === "loading") return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const last30 = days.filter((d) => d.date >= cutoffStr);
    if (last30.length === 0) return 0;
    return Math.round((last30.filter((d) => d.status === "completed").length / last30.length) * 100);
  }, [days]);

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
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Your preparation status at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
            <FlameIcon className="text-warning size-5" />
            <p className="text-2xl font-bold">{streak === "loading" ? "…" : streak.current_streak}</p>
            <p className="text-muted-foreground text-xs">Current streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
            <TrophyIcon className="text-primary size-5" />
            <p className="text-2xl font-bold">{streak === "loading" ? "…" : streak.longest_streak}</p>
            <p className="text-muted-foreground text-xs">Longest streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
            <TargetIcon className="text-primary size-5" />
            <p className="text-2xl font-bold">{completionRate30d ?? "…"}%</p>
            <p className="text-muted-foreground text-xs">Completion rate (30d)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consistency</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {weeklyCompleted === "loading" ? "…" : weeklyCompleted}/7 days completed this week
          </p>
          {days === "loading" ? <Skeleton className="h-16 w-full" /> : <StreakHeatmap days={days} />}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="bg-success size-2.5 rounded-sm" /> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-warning size-2.5 rounded-sm" /> Partial
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-destructive size-2.5 rounded-sm" /> Missed
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUpIcon className="text-primary size-4" />
            Mock test score trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attempts === "loading" ? (
            <Skeleton className="h-32 w-full" />
          ) : trendPoints.length > 1 ? (
            <ScoreTrendChart points={trendPoints} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Take at least two{" "}
              <Link to="/mock-test" className="text-primary underline underline-offset-4">
                mock tests
              </Link>{" "}
              to see a trend.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Syllabus completion</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {subjects === "loading" ? (
            <Skeleton className="h-16 w-full" />
          ) : subjects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No syllabus yet.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24 shrink-0 text-sm">Overall</span>
                <Progress value={overallPercent} />
                <span className="w-10 shrink-0 text-right text-sm font-semibold">{overallPercent}%</span>
              </div>
              {subjects.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-sm">{s.name}</span>
                  <Progress value={s.completionPercent} />
                  <span className="w-10 shrink-0 text-right text-sm">{s.completionPercent}%</span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlertIcon className="text-warning size-4" />
            Weak topics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {weakTopics === "loading" ? (
            <Skeleton className="h-16 w-full" />
          ) : weakTopics.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No weak topics identified yet — keep practicing to build up signal.
            </p>
          ) : (
            weakTopics.map((t) => (
              <div key={t.topicId} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{t.topicName}</p>
                  <p className="text-muted-foreground text-xs">{t.subjectName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{Math.round(t.accuracy * 100)}% accuracy</Badge>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/pyq?topic=${t.topicId}`}>Practice</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
