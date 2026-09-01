"use client";

import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 2, 4, 8];

export function PlaybackControls({
  playing,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpEnd,
  speed,
  onSpeedChange,
  progressLabel,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  progressLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1">
        <button
          onClick={onJumpStart}
          className="rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          title="Jump to start"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={onStepBack}
          className="rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          title="Step back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onTogglePlay}
          className="rounded-md bg-accent p-2 text-accent-fg hover:bg-accent-strong"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={onStepForward}
          className="rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          title="Step forward"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={onJumpEnd}
          className="rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          title="Jump to end"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              speed === s
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border-strong text-text-muted hover:bg-surface-2",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <span className="ml-auto text-xs text-text-faint">{progressLabel}</span>
    </div>
  );
}
