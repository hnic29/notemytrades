import { cn } from "@/lib/utils";

export function TradeScoreGauge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="text-3xl font-semibold text-text-faint">—</div>
        <div className="text-xs text-text-faint">Log 5+ closed trades to unlock</div>
      </div>
    );
  }

  const tone = score >= 70 ? "text-profit" : score >= 40 ? "text-warning" : "text-loss";
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative h-[104px] w-[104px]">
        <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
          <circle cx="52" cy="52" r="42" stroke="#232c40" strokeWidth="10" fill="none" />
          <circle
            cx="52"
            cy="52"
            r="42"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(tone, "stroke-current transition-all duration-500")}
          />
        </svg>
        <div className={cn("absolute inset-0 flex items-center justify-center text-2xl font-semibold", tone)}>
          {score}
        </div>
      </div>
      <div className="text-xs text-text-faint">Trade Score</div>
    </div>
  );
}
