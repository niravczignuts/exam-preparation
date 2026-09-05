import { useEffect, useState } from "react";
import type { ExamStage } from "./useExamStages";

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
    <div className="countdown-tile">
      <h4>{stage.name}</h4>
      {isPast ? (
        <p>This stage has passed.</p>
      ) : (
        <p className="countdown-value">
          {days}d {hours}h {minutes}m
        </p>
      )}
      <button type="button" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
