"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Link2, Link2Off, CheckCircle2, Download, Trash2 } from "lucide-react";
import { BacktestChart, type ChartDrawing } from "./BacktestChart";
import { BacktestRuleBuilder } from "@/components/ai/BacktestRuleBuilder";
import { BacktestSummary } from "@/components/ai/BacktestSummary";
import { PendingOrdersPanel } from "./PendingOrdersPanel";
import { PlaybackControls } from "./PlaybackControls";
import { StartingBalanceControl } from "./StartingBalanceControl";
import { TradeControls, type OpenOrderInput, type PlacePendingOrderInput } from "./TradeControls";
import {
  cancelPendingOrder,
  closeBacktestTrade,
  completeSession,
  deleteBacktestTrade,
  deleteSession,
  evaluateCandleForSession,
  generateSessionShareLink,
  getContextCandles,
  placeBacktestTrade,
  placePendingOrder,
  revokeSessionShareLink,
  setBacktestStartingBalance,
} from "@/lib/actions/backtesting";
import { clearDrawings, createDrawing, type DrawingInput } from "@/lib/actions/chart-drawings";
import { EquityCurveChart } from "@/components/dashboard/EquityCurveChart";
import { computeDetailedStats } from "@/lib/analytics/detailed-stats";
import { bySide, byHourOfDay, computeRiskMetrics } from "@/lib/analytics/grouping";
import { computeRiskRatios } from "@/lib/analytics/risk-ratios";
import { computeDrawdown, computeEquityCurve, computeSummaryStats } from "@/lib/analytics/stats";
import { toReportTrades } from "@/lib/backtesting/report-adapters";
import { resolveMultiplier } from "@/lib/backtesting/trade-factory";
import { getFuturesPointValue } from "@/lib/import/futures";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { TIMEFRAME_OPTIONS, type Candle, type Timeframe } from "@/lib/market-data/yahoo";
import { cn } from "@/lib/utils";

type SessionTrade = {
  id: string;
  symbol: string;
  side: string;
  assetType: string;
  quantity: number;
  multiplier: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  stopLoss: number | null;
  profitTarget: number | null;
  fees: number;
  commissions: number;
  openedAt: Date;
  closedAt: Date | null;
  netPnl: number;
  netRoi: number | null;
  autoBreakevenR: number | null;
  tags: { tag: { name: string } }[];
};

type PendingOrder = {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  triggerPrice: number;
  quantity: number;
};

export function BacktestWorkspace({
  sessionId,
  accountId,
  symbol,
  assetType,
  timeframe,
  status,
  shareSlug: initialShareSlug,
  candles,
  trades,
  pendingOrders,
  drawings,
  startingBalance,
  startDate,
  endDate,
}: {
  sessionId: string;
  accountId: string;
  symbol: string;
  assetType: string;
  timeframe: string;
  status: string;
  shareSlug: string | null;
  candles: Candle[];
  trades: SessionTrade[];
  pendingOrders: PendingOrder[];
  drawings: ChartDrawing[];
  startingBalance: number;
  startDate: Date;
  endDate: Date;
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(() => Math.min(50, candles.length));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [shareSlug, setShareSlug] = useState(initialShareSlug);
  const [copied, setCopied] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>(timeframe as Timeframe);
  const [contextCandles, setContextCandles] = useState<Candle[] | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

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

  const multiplier = resolveMultiplier(symbol, assetType);
  const unknownFuturesRoot = assetType === "futures" && getFuturesPointValue(symbol) == null;

  const stats = useMemo(() => computeSummaryStats(trades), [trades]);
  const reportTrades = useMemo(() => toReportTrades(trades), [trades]);
  const detailedStats = useMemo(() => computeDetailedStats(trades), [trades]);
  const riskMetrics = useMemo(() => computeRiskMetrics(reportTrades), [reportTrades]);
  const riskRatios = useMemo(
    () => computeRiskRatios(trades, startingBalance, startDate, endDate),
    [trades, startingBalance, startDate, endDate],
  );
  const equityCurve = useMemo(() => computeEquityCurve(trades, startingBalance), [trades, startingBalance]);
  const maxDrawdownPct = useMemo(() => computeDrawdown(equityCurve).maxDrawdownPct, [equityCurve]);
  const sideBreakdown = useMemo(() => bySide(reportTrades), [reportTrades]);
  const bestHour = useMemo(() => {
    const hours = byHourOfDay(reportTrades);
    return hours.length > 0
      ? hours.reduce((best, h) => (h.stats.netPnl > best.stats.netPnl ? h : best))
      : null;
  }, [reportTrades]);

  const handleExportCsv = () => {
    const rows = trades.map((t) => ({
      opened: t.openedAt.toISOString(),
      closed: t.closedAt?.toISOString() ?? "",
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      entry: t.avgEntryPrice,
      exit: t.avgExitPrice ?? "",
      stopLoss: t.stopLoss ?? "",
      profitTarget: t.profitTarget ?? "",
      netPnl: t.netPnl,
      netRoi: t.netRoi ?? "",
      tags: t.tags.map((tt) => tt.tag.name).join("|"),
    }));
    downloadCsv(`backtest-${symbol}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  // Fills pending limit/stop orders and applies auto-breakeven for
  // whichever candle just became visible — only bothers the server when
  // there's actually a pending order or an auto-breakeven trade to
  // check, so a plain market-order session stays exactly as chatty as
  // before this feature existed.
  useEffect(() => {
    if (!currentCandle) return;
    const needsEval = pendingOrders.length > 0 || openTrade?.autoBreakevenR != null;
    if (!needsEval) return;
    evaluateCandleForSession(sessionId, accountId, assetType, currentCandle).then((result) => {
      if (result.filledOrderIds.length > 0 || result.breakevenApplied) router.refresh();
    });
    // Deliberately keyed on visibleCount alone: re-run once per newly
    // revealed candle, not on every pendingOrders/openTrade change a
    // router.refresh() from this same effect produces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount]);

  const handleOpen = async (input: OpenOrderInput) => {
    if (!currentCandle) return;
    await placeBacktestTrade(sessionId, {
      accountId,
      symbol,
      assetType,
      side: input.side,
      quantity: input.quantity,
      entryPrice: currentCandle.close,
      entryTime: new Date(currentCandle.time * 1000).toISOString(),
      stopLoss: input.stopLoss,
      profitTarget: input.profitTarget,
      autoBreakevenR: input.autoBreakevenR,
    });
    router.refresh();
  };

  const handlePlaceOrder = async (input: PlacePendingOrderInput) => {
    await placePendingOrder(sessionId, {
      symbol,
      side: input.side,
      orderType: input.orderType,
      triggerPrice: input.triggerPrice,
      quantity: input.quantity,
      stopLoss: input.stopLoss,
      profitTarget: input.profitTarget,
      autoBreakevenR: input.autoBreakevenR,
    });
    router.refresh();
  };

  const handleCancelOrder = async (orderId: string) => {
    await cancelPendingOrder(orderId, sessionId);
    router.refresh();
  };

  const handleSaveStartingBalance = async (accId: string, value: number) => {
    await setBacktestStartingBalance(accId, value);
    router.refresh();
  };

  // Changing the chart's timeframe is a read-only "look at a different
  // bar interval for context" view — it never touches the session's own
  // timeframe, so replay position, pending orders, and auto-breakeven
  // all stay anchored to the original candles regardless of what's
  // currently on screen.
  const handleTimeframeChange = async (tf: Timeframe) => {
    setChartTimeframe(tf);
    if (tf === (timeframe as Timeframe)) {
      setContextCandles(null);
      return;
    }
    setIsLoadingContext(true);
    try {
      const result = await getContextCandles(
        symbol,
        assetType,
        tf,
        startDate.toISOString(),
        endDate.toISOString(),
      );
      setContextCandles(result);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleCreateDrawing = async (input: DrawingInput) => {
    await createDrawing(sessionId, input);
    router.refresh();
  };

  const handleClearDrawings = async () => {
    await clearDrawings(sessionId);
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
          onClick={handleExportCsv}
          disabled={trades.length === 0}
          className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>

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

      <div data-testid="analytics-section">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SmallStat
            label="Expectancy"
            value={formatCurrency(detailedStats.expectancy)}
            tone={detailedStats.expectancy >= 0 ? "profit" : "loss"}
          />
          <SmallStat
            label="Avg R-Multiple"
            value={riskMetrics.avgRMultiple != null ? `${riskMetrics.avgRMultiple.toFixed(2)}R` : "—"}
          />
          <SmallStat label="Max Drawdown" value={formatPercent(maxDrawdownPct)} tone="loss" />
          <SmallStat
            label="Best Hour"
            value={bestHour ? `${bestHour.label} (${formatCurrency(bestHour.stats.netPnl)})` : "—"}
          />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <SmallStat
            label="Sharpe (daily)"
            value={riskRatios.sharpe != null ? riskRatios.sharpe.toFixed(2) : "—"}
          />
          <SmallStat
            label="Sortino (daily)"
            value={riskRatios.sortino != null ? riskRatios.sortino.toFixed(2) : "—"}
          />
          <SmallStat
            label="Calmar"
            value={riskRatios.calmar != null ? riskRatios.calmar.toFixed(2) : "—"}
          />
        </div>
        {(riskRatios.sharpe == null || riskRatios.sortino == null || riskRatios.calmar == null) && (
          <p className="mb-4 text-xs text-text-faint">
            Sharpe/Sortino/Calmar need a starting balance and at least 5 distinct trading days of
            closed trades to calculate — set a starting balance above and keep trading the session.
          </p>
        )}

        {sideBreakdown.length > 1 && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            {sideBreakdown.map((s) => (
              <SmallStat
                key={s.key}
                label={`${s.label === "long" ? "Long" : "Short"} Win Rate`}
                value={s.stats.winRate != null ? formatPercent(s.stats.winRate) : "—"}
              />
            ))}
          </div>
        )}

        {equityCurve.length >= 2 && (
          <div className="mb-4 rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-2 text-xs font-medium text-text-muted">Equity Curve</h3>
            <EquityCurveChart data={equityCurve} />
          </div>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        {candles.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-faint">
            No chart data available for this symbol/timeframe/date range.
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-text-faint">Timeframe:</span>
              {TIMEFRAME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isLoadingContext}
                  onClick={() => handleTimeframeChange(opt.value)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs disabled:opacity-50",
                    chartTimeframe === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border-strong text-text-muted hover:border-accent/50",
                  )}
                >
                  {opt.value}
                </button>
              ))}
              {contextCandles != null && (
                <span className="text-xs text-text-faint">
                  (viewing full range for context — replay stays on {timeframe})
                </span>
              )}
              {isLoadingContext && <span className="text-xs text-text-faint">Loading…</span>}
            </div>
            <BacktestChart
              candles={contextCandles ?? visibleCandles}
              trades={trades}
              drawings={drawings}
              onCreateDrawing={handleCreateDrawing}
              onClearDrawings={handleClearDrawings}
            />
          </>
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

          <div className="mb-4">
            <StartingBalanceControl
              accountId={accountId}
              startingBalance={startingBalance}
              onSave={handleSaveStartingBalance}
            />
          </div>

          {unknownFuturesRoot && (
            <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              Don&apos;t recognize {symbol}&apos;s point value — using $1 per point as a fallback, so
              P&amp;L and risk sizing here won&apos;t match the real contract.
            </p>
          )}

          <PendingOrdersPanel orders={pendingOrders} onCancel={handleCancelOrder} />

          <div className="mb-6">
            <TradeControls
              currentCandle={currentCandle}
              openTrade={openTrade}
              currentBalance={startingBalance + stats.netPnl}
              multiplier={multiplier}
              onOpen={handleOpen}
              onPlaceOrder={handlePlaceOrder}
              onClose={handleClose}
            />
          </div>
        </>
      )}

      <BacktestRuleBuilder
        sessionId={sessionId}
        accountId={accountId}
        assetType={assetType}
        onRan={() => router.refresh()}
      />

      <BacktestSummary sessionId={sessionId} />

      <div data-testid="trades-table">
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
                  <th className="px-3 py-2">Tags</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-muted">
                      <Link href={`/trades/${t.id}`} className="text-accent hover:underline">
                        {formatDateTime(t.openedAt)}
                      </Link>
                    </td>
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
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {t.tags.map((tt) => (
                          <span
                            key={tt.tag.name}
                            className="rounded-full border border-border-strong px-2 py-0.5 text-xs text-text-muted"
                          >
                            {tt.tag.name}
                          </span>
                        ))}
                        <Link
                          href={`/trades/${t.id}/edit`}
                          className="text-xs text-text-faint hover:text-accent"
                        >
                          {t.tags.length > 0 ? "edit" : "+ tag"}
                        </Link>
                      </div>
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
