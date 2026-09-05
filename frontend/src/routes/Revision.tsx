import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckIcon, ClockIcon, MessageCircleQuestionIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { useAiFeaturesEnabled } from "@/lib/aiFeatures";
import {
  isDue,
  reviewRevisionItem,
  useClearedItems,
  useRevisionQueue,
  type RevisionItem,
} from "@/revision/useRevisionQueue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

function ReviewCard({ item, onDone }: { item: RevisionItem; onDone: () => void }) {
  const navigate = useNavigate();
  const aiFeaturesEnabled = useAiFeaturesEnabled();
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const isMcq = item.questions.options.length > 0;
  const isSelectedCorrect =
    selected != null && item.questions.correct_answer != null
      ? selected.trim() === item.questions.correct_answer.trim()
      : null;

  async function handleGrade(wasCorrect: boolean) {
    const { error } = await reviewRevisionItem(item, wasCorrect);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(wasCorrect ? "Nice — scheduled for later review" : "Reset to review again tomorrow");
    onDone();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">
            {item.questions.topics
              ? `${item.questions.topics.subjects?.name} · ${item.questions.topics.name}`
              : "Untagged"}
          </Badge>
          <Badge variant="outline">Stage {item.interval_stage}d</Badge>
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{item.questions.question_text}</p>
          {aiFeaturesEnabled && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() =>
                navigate("/doubts", {
                  state: { prefill: `Can you explain this question?\n\n${item.questions.question_text}` },
                })
              }
            >
              <MessageCircleQuestionIcon /> Ask a doubt
            </Button>
          )}
        </div>

        {isMcq ? (
          <div className="flex flex-col gap-2">
            {item.questions.options.map((option) => {
              const isThisCorrect = revealed && option.trim() === item.questions.correct_answer?.trim();
              const isThisSelected = option === selected;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={revealed}
                  onClick={() => {
                    setSelected(option);
                    setRevealed(true);
                  }}
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
          <>
            {!revealed && (
              <>
                <Textarea placeholder="Try answering before revealing…" />
                <Button size="sm" className="w-fit" onClick={() => setRevealed(true)}>
                  Reveal answer
                </Button>
              </>
            )}
          </>
        )}

        {revealed && (
          <div className="bg-muted/50 flex flex-col gap-1 rounded-md p-3 text-sm">
            {item.questions.correct_answer && <p className="font-medium">{item.questions.correct_answer}</p>}
            {item.questions.explanation && (
              <p className="text-muted-foreground">{item.questions.explanation}</p>
            )}
          </div>
        )}

        {revealed && (
          <div className="flex gap-2">
            {isMcq ? (
              <Button size="sm" onClick={() => handleGrade(!!isSelectedCorrect)} className="w-fit">
                {isSelectedCorrect ? "Correct — continue" : "Incorrect — continue"}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => handleGrade(false)}>
                  <XIcon /> Wrong again
                </Button>
                <Button size="sm" onClick={() => handleGrade(true)}>
                  <CheckIcon /> Got it right
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Revision() {
  const { items, refresh } = useRevisionQueue();
  const { items: cleared } = useClearedItems();
  const [showArchive, setShowArchive] = useState(false);

  const { due, upcoming } = useMemo(() => {
    if (items === "loading") return { due: [], upcoming: [] };
    return {
      due: items.filter(isDue),
      upcoming: items.filter((i) => !isDue(i)),
    };
  }, [items]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revision Queue</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Spaced repetition over questions you got wrong or skipped.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowArchive((v) => !v)}>
          {showArchive ? "Back to queue" : `Archive (${cleared === "loading" ? "…" : cleared.length})`}
        </Button>
      </div>

      {items === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : showArchive ? (
        <div className="flex flex-col gap-2">
          {cleared === "loading" || cleared.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cleared items yet.</p>
          ) : (
            cleared.map((item) => (
              <Card key={item.id} className="gap-1 py-3">
                <CardContent className="text-sm">
                  <p className="font-medium">{item.questions.question_text}</p>
                  <Badge variant="success" className="mt-1">
                    Cleared
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : due.length > 0 ? (
        <ReviewCard item={due[0]} onDone={refresh} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nothing due for review right now — nice work!
          </CardContent>
        </Card>
      )}

      {!showArchive && upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Upcoming</h2>
          {upcoming.map((item) => (
            <div
              key={item.id}
              className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2 text-sm"
            >
              <span className="truncate">{item.questions.question_text}</span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                <ClockIcon className="size-3" /> {item.next_review_date}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
