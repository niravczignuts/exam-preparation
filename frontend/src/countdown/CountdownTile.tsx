import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";

import type { ExamStage } from "@/hooks/useExamStages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CountdownTile({
  stage,
  onRemove,
}: {
  stage: ExamStage;
  onRemove: () => void;
}) {
  const targetTime = new Date(`${stage.exam_date}T${stage.exam_time}`).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isPast = targetTime <= now;
  const diffMs = Math.max(targetTime - now, 0);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return (
    <Card className="relative min-w-40 flex-1 gap-1 py-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-6"
        onClick={onRemove}
        aria-label={`Remove ${stage.name}`}
      >
        <XIcon className="size-3.5" />
      </Button>
      <div className="px-4">
        <p className="text-muted-foreground text-sm font-medium">{stage.name}</p>
        {isPast ? (
          <p className="mt-1 text-sm">This stage has passed.</p>
        ) : (
          <p className="text-primary mt-1 flex items-baseline gap-1.5 text-2xl font-bold tabular-nums">
            {days}
            <span className="text-muted-foreground text-xs font-normal">d</span>
            {String(hours).padStart(2, "0")}
            <span className="text-muted-foreground text-xs font-normal">h</span>
            {String(minutes).padStart(2, "0")}
            <span className="text-muted-foreground text-xs font-normal">m</span>
          </p>
        )}
      </div>
    </Card>
  );
}
