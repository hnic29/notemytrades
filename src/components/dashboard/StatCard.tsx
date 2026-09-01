import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "neutral";
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "neutral" && "text-text",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-text-faint">{sub}</div>}
    </div>
  );
}
