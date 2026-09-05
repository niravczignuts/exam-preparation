import { useState } from "react";

interface Point {
  date: string;
  score: number;
}

const WIDTH = 480;
const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 32 };

/** A single-series line chart (KAN-33) — one hue (the theme primary), thin 2px
 * line with rounded ends, recessive gridlines, and a hover crosshair + tooltip.
 * No legend needed for a single series; the section title names it, and the
 * history list beside it already serves as the accessible table-view
 * alternative. */
export function ScoreTrendChart({ points }: { points: Point[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const xFor = (i: number) =>
    PAD.left + (points.length === 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth);
  const yFor = (score: number) => PAD.top + innerHeight * (1 - score / 100);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.score)}`).join(" ");
  const gridScores = [0, 25, 50, 75, 100];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Mock test score trend">
        {gridScores.map((score) => (
          <g key={score}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yFor(score)}
              y2={yFor(score)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text x={4} y={yFor(score) + 3} className="fill-muted-foreground text-[9px]">
              {score}
            </text>
          </g>
        ))}

        <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={xFor(i)}
              cy={yFor(p.score)}
              r={8}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              className="cursor-pointer"
            />
            <circle cx={xFor(i)} cy={yFor(p.score)} r={3} className="fill-primary" />
          </g>
        ))}
      </svg>
      {hoverIndex != null && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-xs shadow-md"
          style={{
            left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
            top: `${(yFor(points[hoverIndex].score) / HEIGHT) * 100}%`,
          }}
        >
          <p className="font-medium">{points[hoverIndex].score}%</p>
          <p className="text-muted-foreground">{points[hoverIndex].date}</p>
        </div>
      )}
    </div>
  );
}
