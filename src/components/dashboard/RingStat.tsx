import { cn } from "@/lib/utils";

/** A small circular progress ring for a 0..1 (or capped) stat, e.g. win
 * rate or profit factor — generalizes the Trade Score gauge so any
 * stat card can render as a ring instead of bare text. */
export function RingStat({
  label,
  value,
  displayValue,
  tone = "accent",
}: {
  label: string;
  /** 0..1 fill fraction, already clamped by the caller. */
  value: number | null;
  displayValue: string;
  tone?: "accent" | "profit" | "loss" | "warning";
}) {
  const clamped = value == null ? 0 : Math.max(0, Math.min(1, value));
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - clamped);

  const toneClass = {
    accent: "text-accent",
    profit: "text-profit",
    loss: "text-loss",
    warning: "text-warning",
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r="26" stroke="#232c40" strokeWidth="7" fill="none" />
          {value != null && (
            <circle
              cx="32"
              cy="32"
              r="26"
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(toneClass, "stroke-current transition-all duration-500")}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-text">
          {displayValue}
        </div>
      </div>
      <div className="text-xs text-text-faint">{label}</div>
    </div>
  );
}
