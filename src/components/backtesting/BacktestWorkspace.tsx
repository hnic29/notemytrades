"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Link2, Link2Off, CheckCircle2, Trash2 } from "lucide-react";
import { BacktestChart } from "./BacktestChart";
import { BacktestSummary } from "@/components/ai/BacktestSummary";
import { PlaybackControls } from "./PlaybackControls";
import { TradeControls } from "./TradeControls";
import {
  closeBacktestTrade,
  completeSession,
  deleteBacktestTrade,
  deleteSession,
  generateSessionShareLink,
  placeBacktestTrade,
  revokeSessionShareLink,
} from "@/lib/actions/backtesting";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import type { Candle } from "@/lib/market-data/yahoo";
import { cn } from "@/lib/utils";

type SessionTrade = {
  id: string;
  side: string;
  quantity: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  openedAt: Date;
  closedAt: Date | null;
  netPnl: number;
  netRoi: number | null;
};

export function BacktestWorkspace({
  sessionId,
  accountId,
  symbol,
  status,
  shareSlug: initialShareSlug,
  candles,
  trades,
  startingBalance,
}: {
  sessionId: string;
  accountId: string;
  symbol: string;
  status: string;
  shareSlug: string | null;
  candles: Candle[];
  trades: SessionTrade[];
  startingBalance: number;
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(() => Math.min(50, candles.length));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [shareSlug, setShareSlug] = useState(initialShareSlug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (visibleCount >= candles.length) {
      // Correcting playing->false once playback reaches the end is the
      // external-timer/state-machine case set-state-in-effect exists to
      // flag false positives on — there's no event to hang this off of.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, candles.length)), 500 / speed);
    return () => clearTimeout(id);
  }, [playing, speed, visibleCount, candles.length]);

  const visibleCandles = candles.slice(0, visibleCount);
  const currentCandle = visibleCandles[visibleCandles.length - 1] ?? null;
  const openTrade = trades.find((t) => t.avgExitPrice == null) ?? null;

  const stats = useMemo(() => computeSummaryStats(trades), [trades]);

  const handleOpen = async (input: {
    side: "long" | "short";
    quantity: number;
    stopLoss: number | null;
    profitTarget: number | null;
  }) => {
    if (!currentCandle) return;
    await placeBacktestTrade(sessionId, {
      accountId,
      symbol,
      side: input.side,
      quantity: input.quantity,
      entryPrice: currentCandle.close,
      entryTime: new Date(currentCandle.time * 1000).toISOString(),
      stopLoss: input.stopLoss,
      profitTarget: input.profitTarget,
    });
    router.refresh();
  };

  const handleClose = async () => {
    if (!currentCandle || !openTrade) return;
    await closeBacktestTrade(openTrade.id, sessionId, {
      exitPrice: currentCandle.close,
      exitTime: new Date(currentCandle.time * 1000).toISOString(),
    });
    router.refresh();
  };

  const shareUrl =
    shareSlug && typeof window !== "undefined"
      ? `${window.location.origin}/s/backtesting/${shareSlug}`
      : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {status === "in_progress" ? (
          <button
            onClick={() => completeSession(sessionId).then(() => router.refresh())}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text hover:bg-surface-2"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
          </button>
        ) : (
          <span className="rounded-full border border-profit/40 bg-profit-bg px-2.5 py-1 text-xs text-profit">
            Completed
          </span>
        )}

        {shareSlug ? (
          <>
            <button
              onClick={() => {
                if (shareUrl) {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }
              }}
              className="flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
            >
              <Link2 className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy Share Link"}
            </button>
            <button
              onClick={() => revokeSessionShareLink(sessionId).then(() => setShareSlug(null))}
              className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            >
              <Link2Off className="h-3.5 w-3.5" /> Revoke
            </button>
          </>
        ) : (
          <button
            onClick={() => generateSessionShareLink(sessionId).then(setShareSlug)}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
          >
            <Link2 className="h-3.5 w-3.5" /> Share
          </button>
        )}

        <button
          onClick={() => {
            if (!window.confirm("Delete this backtesting session and all its trades?")) return;
            deleteSession(sessionId).then(() => router.push("/backtesting"));
          }}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-loss/40 px-3 py-1.5 text-sm text-loss hover:bg-loss-bg"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SmallStat
          label="Net P&L"
          value={formatCurrency(stats.netPnl)}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
        <SmallStat label="Trades" value={String(stats.closedTrades)} />
        <SmallStat
          label="Win Rate"
          value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
        />
        <SmallStat
          label="Profit Factor"
          value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
        />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        {candles.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-faint">
            No chart data available for this symbol/timeframe/date range.
          </p>
        ) : (
          <BacktestChart candles={visibleCandles} trades={trades} />
        )}
      </div>

      {candles.length > 0 && (
        <>
          <div className="mb-4">
            <PlaybackControls
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
              onStepBack={() => setVisibleCount((c) => Math.max(2, c - 1))}
              onStepForward={() => setVisibleCount((c) => Math.min(candles.length, c + 1))}
              onJumpStart={() => setVisibleCount(Math.min(50, candles.length))}
              onJumpEnd={() => setVisibleCount(candles.length)}
              speed={speed}
              onSpeedChange={setSpeed}
              progressLabel={`${visibleCount} / ${candles.length} candles${
                currentCandle ? ` · ${formatDateTime(new Date(currentCandle.time * 1000))}` : ""
              }`}
            />
          </div>

          <div className="mb-6">
            <TradeControls
              currentCandle={currentCandle}
              openTrade={openTrade}
              currentBalance={startingBalance + stats.netPnl}
              onOpen={handleOpen}
              onClose={handleClose}
            />
          </div>
        </>
      )}

      <BacktestSummary sessionId={sessionId} />

      <div>
        <h2 className="mb-3 text-sm font-medium text-text-muted">
          Trades in this session ({trades.length})
        </h2>
        {trades.length === 0 ? (
          <p className="text-sm text-text-faint">No trades placed yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-text-faint">
                  <th className="px-3 py-2">Opened</th>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2">Exit</th>
                  <th className="px-3 py-2">Net P&L</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-muted">{formatDateTime(t.openedAt)}</td>
                    <td className="px-3 py-2 capitalize text-text-muted">{t.side}</td>
                    <td className="px-3 py-2 text-text-muted">{t.quantity}</td>
                    <td className="px-3 py-2 text-text-muted">{formatCurrency(t.avgEntryPrice)}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {t.avgExitPrice != null ? formatCurrency(t.avgExitPrice) : "open"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-medium",
                        t.netPnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {t.avgExitPrice != null ? formatCurrency(t.netPnl) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => deleteBacktestTrade(t.id, sessionId).then(() => router.refresh())}
                        className="text-text-faint hover:text-loss"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          !tone && "text-text",
        )}
      >
        {value}
      </div>
    </div>
  );
}
