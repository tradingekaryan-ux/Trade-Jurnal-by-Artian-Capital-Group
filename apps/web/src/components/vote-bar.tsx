"use client";

export type VoteTone = "profit" | "loss";

export interface VoteSide {
  label: string;
  count: number;
  tone: VoteTone;
}

/** Horizontal percentage bar. Colours are supplied explicitly per side. */
export function VoteBar({ sides }: { sides: [VoteSide, VoteSide] }) {
  const total = sides[0].count + sides[1].count;
  const shares = total === 0 ? [50, 50] : sides.map((side) => (side.count / total) * 100);
  const colour = (tone: VoteTone) => (tone === "profit" ? "bg-profit" : "bg-loss");
  const text = (tone: VoteTone) => (tone === "profit" ? "text-profit" : "text-loss");

  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted text-[0]">
        {sides.map((side, index) => (
          <div
            key={side.label}
            className={`${colour(side.tone)} transition-all duration-500`}
            style={{ width: `${shares[index]}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {sides.map((side, index) => (
          <span key={side.label} className={text(side.tone)}>
            {side.label} {Math.round(shares[index] ?? 0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
