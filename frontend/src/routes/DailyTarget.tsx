import { useState } from "react";
import { FlameIcon, MicIcon, PencilIcon, SendIcon, SquareIcon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";

import { useAiFeaturesEnabled } from "@/lib/aiFeatures";
import { useLanguage } from "@/lib/i18n";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import {
  createTodaysTarget,
  updateTarget,
  useStreak,
  useTodaysTarget,
  useWeeklyCompletion,
} from "@/dailytarget/useDailyTarget";
import {
  finishCheckin,
  startCheckin,
  transcribeCheckinAudio,
  useTodaysCheckin,
} from "@/dailytarget/useCheckin";
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
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABEL: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  completed: "Completed",
  partially_completed: "Partially completed",
  missed: "Missed",
};

function StreakCard() {
  const { streak } = useStreak();
  const weeklyCompleted = useWeeklyCompletion();

  return (
    <Card>
      <CardContent className="flex items-center justify-around gap-4 py-4 text-center">
        <div>
          <p className="flex items-center justify-center gap-1 text-2xl font-bold">
            <FlameIcon className="text-warning size-5" />
            {streak === "loading" ? "…" : streak.current_streak}
          </p>
          <p className="text-muted-foreground text-xs">Current streak</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-2xl font-bold">
            <TrophyIcon className="text-primary size-5" />
            {streak === "loading" ? "…" : streak.longest_streak}
          </p>
          <p className="text-muted-foreground text-xs">Best streak</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{weeklyCompleted === "loading" ? "…" : weeklyCompleted}/7</p>
          <p className="text-muted-foreground text-xs">This week</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EditTargetDialog({ targetId, description, onSaved }: { targetId: string; description: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(description);

  async function handleSave() {
    const { error } = await updateTarget(targetId, { description: value, status: "accepted" });
    if (error) {
      toast.error(error);
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilIcon /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit today's target</DialogTitle>
        </DialogHeader>
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="min-h-24" />
        <DialogFooter>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckinFlow({ targetId, onFinished }: { targetId: string; onFinished: () => void }) {
  const { language } = useLanguage();
  const { checkin, refresh } = useTodaysCheckin();
  const aiFeaturesEnabled = useAiFeaturesEnabled();
  const { isRecording, start: startRecording, stop: stopRecording } = useVoiceRecorder();
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<"completed" | "partially_completed" | "missed" | null>(null);
  const [questionsSolved, setQuestionsSolved] = useState(0);
  const [recallAnswers, setRecallAnswers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  async function handleMicClick() {
    if (isRecording) {
      setTranscribing(true);
      try {
        const audio = await stopRecording();
        const text = await transcribeCheckinAudio(audio);
        setRecallAnswers((prev) => (prev ? `${prev} ${text}` : text));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not transcribe audio");
      } finally {
        setTranscribing(false);
      }
      return;
    }
    try {
      await startRecording();
    } catch {
      toast.error("Couldn't access the microphone — check your browser's site settings.");
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await startCheckin(targetId, language);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start check-in");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit() {
    if (!checkin || checkin === "loading" || !status) return;
    setSubmitting(true);
    try {
      await finishCheckin({
        checkinId: checkin.id,
        status,
        questionsSolved,
        recallAnswers,
        language,
      });
      refresh();
      onFinished();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit check-in");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkin === "loading") return <Skeleton className="h-24 w-full" />;

  if (!checkin) {
    return (
      <Button onClick={handleStart} disabled={starting}>
        <SendIcon /> Start today's check-in
      </Button>
    );
  }

  const isFinished = checkin.transcript.length >= 3;

  return (
    <div className="flex flex-col gap-3">
      {checkin.transcript.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            m.role === "assistant"
              ? "bg-muted self-start"
              : "bg-primary text-primary-foreground self-end"
          }`}
        >
          {m.content}
        </div>
      ))}

      {!isFinished && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(["completed", "partially_completed", "missed"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  onClick={() => setStatus(s)}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Questions solved</Label>
              <Input
                type="number"
                min={0}
                value={questionsSolved}
                onChange={(e) => setQuestionsSolved(Number(e.target.value) || 0)}
                className="w-24"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Your answers to the recall question(s)</Label>
              <div className="flex gap-2">
                <Textarea
                  value={recallAnswers}
                  onChange={(e) => setRecallAnswers(e.target.value)}
                  className="flex-1"
                />
                {aiFeaturesEnabled && (
                  <Button
                    type="button"
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    onClick={handleMicClick}
                    disabled={transcribing}
                    title={isRecording ? "Stop recording" : "Speak your answer instead"}
                    className="h-auto shrink-0"
                  >
                    {isRecording ? <SquareIcon /> : <MicIcon />}
                  </Button>
                )}
              </div>
              {transcribing && <p className="text-muted-foreground text-xs">Transcribing…</p>}
            </div>
            <Button onClick={handleSubmit} disabled={!status || submitting} className="w-fit">
              Send
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function DailyTarget() {
  const { target, refresh } = useTodaysTarget();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  async function handleAccept() {
    if (!target || target === "loading") return;
    await updateTarget(target.id, { status: "accepted" });
    refresh();
  }

  async function handleCreate() {
    if (!draft.trim()) return;
    const { error } = await createTodaysTarget(draft.trim());
    if (error) {
      toast.error(error);
      return;
    }
    setCreating(false);
    setDraft("");
    refresh();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today's Target</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your daily plan, streaks, and end-of-day check-in.
        </p>
      </div>

      <StreakCard />

      {target === "loading" ? (
        <Skeleton className="h-32 w-full" />
      ) : !target ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 py-6">
            <p className="text-muted-foreground text-center text-sm">
              No target proposed for today yet.
            </p>
            {creating ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="What will you study today?"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button onClick={handleCreate} className="w-fit">
                  Save target
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="mx-auto" onClick={() => setCreating(true)}>
                Set today's target
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Today's target</CardTitle>
                <Badge variant={target.status === "proposed" ? "outline" : "secondary"}>
                  {STATUS_LABEL[target.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm whitespace-pre-line">{target.description}</p>
              <div className="flex gap-2">
                {target.status === "proposed" && (
                  <Button size="sm" onClick={handleAccept}>
                    Accept
                  </Button>
                )}
                <EditTargetDialog targetId={target.id} description={target.description} onSaved={refresh} />
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-2 text-lg font-semibold">End-of-day check-in</h2>
            <CheckinFlow targetId={target.id} onFinished={refresh} />
          </div>
        </>
      )}
    </main>
  );
}
