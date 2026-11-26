"use client";

/** Horizontal percentage bar: green vs red share of community votes. */
export function VoteBar({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const total = left + right;
  const leftPct = total === 0 ? 50 : (left / total) * 100;
  const rightPct = total === 0 ? 50 : 100 - leftPct;
  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted text-[0]">
        <div className="bg-profit transition-all duration-500" style={{ width: `${leftPct}%` }} />
        <div className="bg-loss transition-all duration-500" style={{ width: `${rightPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {leftLabel} {Math.round(leftPct)}%
        </span>
        <span>
          {rightLabel} {Math.round(rightPct)}%
        </span>
      </div>
    </div>
  );
}
