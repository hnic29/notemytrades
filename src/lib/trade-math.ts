export type TradeSide = "long" | "short";

export type TradeMathInput = {
  side: TradeSide;
  quantity: number;
  multiplier: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  fees: number;
  commissions: number;
};

export type TradeMathResult = {
  grossPnl: number;
  netPnl: number;
  netRoi: number | null;
  costBasis: number;
};

/**
 * Core P&L math shared by manual entry, CSV import, and reports.
 * Kept pure/deterministic so every caller (server actions, import
 * parsers, dashboard aggregation) computes identical numbers.
 */
export function computeTradeMath(input: TradeMathInput): TradeMathResult {
  const { side, quantity, multiplier, avgEntryPrice, avgExitPrice, fees, commissions } = input;

  const costBasis = Math.abs(avgEntryPrice * quantity * multiplier);

  if (avgExitPrice == null) {
    return { grossPnl: 0, netPnl: -(fees + commissions), netRoi: null, costBasis };
  }

  const direction = side === "long" ? 1 : -1;
  const grossPnl = (avgExitPrice - avgEntryPrice) * quantity * multiplier * direction;
  const netPnl = grossPnl - fees - commissions;
  const netRoi = costBasis === 0 ? null : netPnl / costBasis;

  return { grossPnl, netPnl, netRoi, costBasis };
}

/**
 * Every aggregate stat in the app (dashboard, reports, strategy stats)
 * treats `closedAt != null` as "this trade counts as closed." A trade
 * with an exit price but no closedAt would silently vanish from every
 * one of them, so every ingestion path (manual entry, CSV import, bulk
 * import) must resolve closedAt through this before persisting: if an
 * exit price is set but no close time was given, fall back to the open
 * time rather than leaving the trade in permanent aggregate limbo.
 */
export function resolveClosedAt(
  openedAt: Date,
  closedAt: Date | null,
  avgExitPrice: number | null,
): Date | null {
  if (closedAt) return closedAt;
  if (avgExitPrice != null) return openedAt;
  return null;
}

export type ExecutionLike = {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  isEntry: boolean;
};

/**
 * Reduces a list of entry/exit executions into the weighted-average
 * entry/exit prices and net quantity used by computeTradeMath. Entry vs
 * exit is determined by `isEntry` (set at trade creation from the
 * trade's side), not by buy/sell, so this works for both long and short.
 */
export function averageExecutions(executions: ExecutionLike[]): {
  quantity: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
} {
  const entries = executions.filter((e) => e.isEntry);
  const exits = executions.filter((e) => !e.isEntry);

  const weighted = (rows: ExecutionLike[]) => {
    const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0);
    if (totalQty === 0) return { qty: 0, avgPrice: 0 };
    const weightedSum = rows.reduce((sum, r) => sum + r.quantity * r.price, 0);
    return { qty: totalQty, avgPrice: weightedSum / totalQty };
  };

  const entryAgg = weighted(entries);
  const exitAgg = weighted(exits);

  return {
    quantity: entryAgg.qty,
    avgEntryPrice: entryAgg.avgPrice,
    avgExitPrice: exits.length > 0 ? exitAgg.avgPrice : null,
  };
}
