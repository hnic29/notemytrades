import { computeSummaryStats, type SummaryStats } from "@/lib/analytics/stats";
import { bySymbol, byTag, type ReportTrade } from "@/lib/analytics/grouping";
import { formatCurrency, formatPercent } from "@/lib/format";

/**
 * Renders a compact, numbers-grounded text summary of a trade set for
 * injection into an AI system prompt — the model should never be
 * asked to eyeball raw trade rows or invent statistics, only narrate
 * numbers we've already computed deterministically.
 */
export function buildTradingContextSummary(trades: ReportTrade[]): string {
  const stats = computeSummaryStats(trades);
  if (stats.closedTrades === 0) {
    return "The trader has no closed trades yet.";
  }

  const lines: string[] = [];
  lines.push(summarizeStats(stats));

  const topSymbols = bySymbol(trades).slice(0, 5);
  if (topSymbols.length > 0) {
    lines.push(
      "By symbol: " +
        topSymbols
          .map((g) => `${g.label} ${formatCurrency(g.stats.netPnl)} (${g.stats.closedTrades} trades)`)
          .join(", "),
    );
  }

  const topTags = byTag(trades).slice(0, 5);
  if (topTags.length > 0) {
    lines.push(
      "By tag: " +
        topTags
          .map((g) => `${g.label} ${formatCurrency(g.stats.netPnl)} (${g.stats.closedTrades} trades)`)
          .join(", "),
    );
  }

  return lines.join("\n");
}

function summarizeStats(stats: SummaryStats): string {
  return [
    `${stats.closedTrades} closed trades (${stats.wins} wins, ${stats.losses} losses${
      stats.breakeven ? `, ${stats.breakeven} breakeven` : ""
    }).`,
    `Net P&L: ${formatCurrency(stats.netPnl)}.`,
    stats.winRate != null ? `Win rate: ${formatPercent(stats.winRate)}.` : "",
    stats.profitFactor != null ? `Profit factor: ${stats.profitFactor.toFixed(2)}.` : "",
    `Avg win: ${formatCurrency(stats.avgWin)}, avg loss: ${formatCurrency(-stats.avgLoss)}.`,
    stats.currentStreak !== 0
      ? `Current streak: ${Math.abs(stats.currentStreak)} ${stats.currentStreak > 0 ? "wins" : "losses"} in a row.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const TRADING_ASSISTANT_SYSTEM_PROMPT = `You are a trading journal assistant embedded in "Note My Trades", a self-hosted trading journal. You answer questions about the trader's own logged performance using ONLY the numbers given to you in the context block below — never invent statistics, prices, or trades that aren't there. If the context doesn't contain what's needed to answer, say so plainly instead of guessing. Keep responses concise (a few sentences, or a short list). You are not a financial advisor and should not give buy/sell recommendations on live positions — you help the trader understand their own past performance and patterns.`;
