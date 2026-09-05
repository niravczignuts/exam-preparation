import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellIcon, BookOpenIcon, CheckCircle2Icon, CircleAlertIcon, CircleIcon } from "lucide-react";
import { toast } from "sonner";

import { CountdownTile } from "@/countdown/CountdownTile";
import { useExamStages } from "@/hooks/useExamStages";
import { ensurePushRegistered } from "@/lib/pushNotifications";
import { useSyllabusTree } from "@/syllabus/useSyllabusTree";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "unreachable">("checking");
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "unsupported" | "checking">(
    "checking",
  );
  const { stages, loading, deleteStage } = useExamStages();
  const { subjects, overallPercent } = useSyllabusTree();

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    fetch(`${base}/health`)
      .then((res) => (res.ok ? setApiStatus("ok") : setApiStatus("unreachable")))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPushStatus("unsupported");
      return;
    }
    setPushStatus(Notification.permission === "granted" ? "granted" : "denied");
  }, []);

  async function enableNotifications() {
    setPushStatus("checking");
    const result = await ensurePushRegistered();
    setPushStatus(result);
    if (result === "granted") toast.success("Notifications enabled");
    else toast.error("Couldn't enable notifications — check your browser's site settings.");
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Exam Prep App</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your countdown, syllabus progress, and reminders — all in one place.
        </p>
      </div>

      <section>
        {loading ? (
          <div className="flex gap-4">
            <Skeleton className="h-24 flex-1" />
            <Skeleton className="h-24 flex-1" />
          </div>
        ) : stages.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {stages.map((stage) => (
              <CountdownTile key={stage.id} stage={stage} onRemove={() => deleteStage(stage.id)} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center text-sm">
              <CircleAlertIcon className="size-5" />
              No exam dates configured yet.
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">Add one in Settings</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenIcon className="text-primary size-4" />
              Syllabus progress
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {subjects === "loading" ? (
              <Skeleton className="h-2 w-full" />
            ) : subjects.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No syllabus yet —{" "}
                <Link to="/syllabus" className="text-primary underline underline-offset-4">
                  add one
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall completion</span>
                  <span className="font-semibold tabular-nums">{overallPercent}%</span>
                </div>
                <Progress value={overallPercent} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellIcon className="text-primary size-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              {apiStatus === "ok" ? (
                <CheckCircle2Icon className="text-success size-4" />
              ) : apiStatus === "checking" ? (
                <CircleIcon className="size-4 animate-pulse" />
              ) : (
                <CircleAlertIcon className="text-destructive size-4" />
              )}
              Backend API: {apiStatus}
            </p>

            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              {pushStatus === "granted" ? (
                <>
                  <CheckCircle2Icon className="text-success size-4" /> Reminders enabled on this device
                </>
              ) : pushStatus === "checking" ? (
                <>
                  <CircleIcon className="size-4 animate-pulse" /> Checking permission…
                </>
              ) : (
                <>
                  <CircleAlertIcon className="text-warning size-4" /> Reminders not enabled
                </>
              )}
            </p>

            {pushStatus !== "granted" && pushStatus !== "checking" && (
              <Button type="button" size="sm" variant="outline" onClick={enableNotifications} className="w-fit">
                Enable notifications
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
