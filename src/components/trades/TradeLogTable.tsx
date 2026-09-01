"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  Trash2,
  Split,
  Combine,
  Download,
  Settings2,
  ChevronDown,
  Tag as TagIcon,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { computeSummaryStats } from "@/lib/analytics/stats";
import type { TradeWithAccount } from "@/lib/queries/trades";
import {
  addTagToTrades,
  deleteTrades,
  mergeTrades,
  splitTrade,
  transferTrades,
} from "@/lib/actions/trades";
import { StatCard } from "@/components/dashboard/StatCard";

type Column = {
  key: string;
  label: string;
  defaultVisible: boolean;
};

const COLUMNS: Column[] = [
  { key: "openedAt", label: "Date", defaultVisible: true },
  { key: "symbol", label: "Symbol", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "side", label: "Side", defaultVisible: true },
  { key: "quantity", label: "Qty", defaultVisible: true },
  { key: "avgEntryPrice", label: "Entry", defaultVisible: true },
  { key: "avgExitPrice", label: "Exit", defaultVisible: true },
  { key: "fees", label: "Fees", defaultVisible: false },
  { key: "netPnl", label: "Net P&L", defaultVisible: true },
  { key: "netRoi", label: "ROI", defaultVisible: true },
  { key: "account", label: "Account", defaultVisible: true },
  { key: "tags", label: "Tags", defaultVisible: false },
];

const STORAGE_KEY = "nmt.tradeLog.columns.v2";
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function loadColumnPrefs(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultVisible]));
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no prefs");
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultVisible]));
  }
}

type SortKey = "openedAt" | "symbol" | "netPnl" | "netRoi" | "quantity";

export function TradeLogTable({
  trades,
  accounts,
}: {
  trades: TradeWithAccount[];
  accounts: { id: string; name: string }[];
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>(loadColumnPrefs);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showTransferMenu, setShowTransferMenu] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("openedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleColumn = (key: string) => {
    const next = { ...visible, [key]: !visible[key] };
    setVisible(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const stats = useMemo(() => computeSummaryStats(trades), [trades]);

  const sorted = useMemo(() => {
    const rows = [...trades];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "openedAt") cmp = a.openedAt.getTime() - b.openedAt.getTime();
      else if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "netPnl") cmp = a.netPnl - b.netPnl;
      else if (sortKey === "quantity") cmp = a.quantity - b.quantity;
      else if (sortKey === "netRoi") cmp = (a.netRoi ?? 0) - (b.netRoi ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [trades, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === pageRows.length ? new Set() : new Set(pageRows.map((t) => t.id)),
    );
  };

  const runBulk = (
    label: string,
    action: () => Promise<{ ok: true } | { ok: false; error: string } | void>,
  ) => {
    setError(null);
    setShowBulkMenu(false);
    setShowTransferMenu(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && !result.ok) {
          setError(result.error);
          return;
        }
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to ${label}`);
      }
    });
  };

  const handleSplit = (id: string, quantity: number) => {
    const input = window.prompt(
      `Split this trade of quantity ${quantity}. Quantity to keep on the original:`,
      String(quantity / 2),
    );
    if (!input) return;
    const keepQuantity = Number(input);
    if (!Number.isFinite(keepQuantity)) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await splitTrade(id, keepQuantity);
        if (!result.ok) setError(result.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to split trade");
      }
    });
  };

  const handleExportCsv = () => {
    const rows = sorted.map((t) => ({
      date: t.openedAt.toISOString(),
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      entry: t.avgEntryPrice,
      exit: t.avgExitPrice ?? "",
      fees: t.fees,
      commissions: t.commissions,
      netPnl: t.netPnl,
      netRoi: t.netRoi ?? "",
      account: t.account.name,
      tags: t.tags.map((tt) => tt.tag.name).join("|"),
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const col = (key: string) => visible[key] !== false;

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
        <p className="text-text-muted">No trades yet.</p>
        <Link
          href="/trades/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          Add your first trade
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Net Cumulative P&L"
          value={formatCurrency(stats.netPnl)}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
        />
        <StatCard
          label="Trade Win %"
          value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
          sub={`${stats.wins}W / ${stats.losses}L`}
        />
        <StatCard label="Avg Win / Avg Loss" value={`${formatCurrency(stats.avgWin)} / ${formatCurrency(-stats.avgLoss)}`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {selected.size > 0 ? (
          <div className="relative">
            <button
              onClick={() => setShowBulkMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent"
            >
              {selected.size} selected · Bulk Actions <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showBulkMenu && (
              <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-border bg-surface-2 p-1 shadow-lg">
                <button
                  onClick={() => runBulk("delete", () => deleteTrades(Array.from(selected)))}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-loss hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                {selected.size >= 2 && (
                  <button
                    onClick={() => runBulk("merge", () => mergeTrades(Array.from(selected)))}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Combine className="h-3.5 w-3.5" /> Merge
                  </button>
                )}
                <button
                  onClick={() => {
                    const tag = window.prompt("Tag to add to all selected trades:");
                    if (!tag) return;
                    runBulk("add tag", () => addTagToTrades(Array.from(selected), tag));
                  }}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TagIcon className="h-3.5 w-3.5" /> Add Tag
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowTransferMenu((v) => !v)}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer to Account
                  </button>
                  {showTransferMenu && (
                    <div className="absolute left-full top-0 z-20 ml-1 w-48 rounded-md border border-border bg-surface-2 p-1 shadow-lg">
                      {accounts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() =>
                            runBulk("transfer", () => transferTrades(Array.from(selected), a.id))
                          }
                          disabled={isPending}
                          className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-text hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-8" />
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            >
              <Settings2 className="h-3.5 w-3.5" /> Columns
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-border bg-surface-2 p-2 shadow-lg">
                {COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface-3"
                  >
                    <input
                      type="checkbox"
                      checked={col(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      className="accent-accent"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-text-faint">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === pageRows.length && pageRows.length > 0}
                  onChange={toggleSelectAll}
                  className="accent-accent"
                />
              </th>
              {col("openedAt") && <Th onClick={() => handleSort("openedAt")}>Date</Th>}
              {col("symbol") && <Th onClick={() => handleSort("symbol")}>Symbol</Th>}
              {col("status") && <Th>Status</Th>}
              {col("side") && <Th>Side</Th>}
              {col("quantity") && <Th onClick={() => handleSort("quantity")}>Qty</Th>}
              {col("avgEntryPrice") && <Th>Entry</Th>}
              {col("avgExitPrice") && <Th>Exit</Th>}
              {col("fees") && <Th>Fees</Th>}
              {col("netPnl") && <Th onClick={() => handleSort("netPnl")}>Net P&L</Th>}
              {col("netRoi") && <Th onClick={() => handleSort("netRoi")}>ROI</Th>}
              {col("account") && <Th>Account</Th>}
              {col("tags") && <Th>Tags</Th>}
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <tr
                key={t.id}
                className="border-b border-border last:border-0 hover:bg-surface"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                    className="accent-accent"
                  />
                </td>
                {col("openedAt") && (
                  <td className="px-3 py-2 text-text-muted">
                    <Link href={`/trades/${t.id}`} className="hover:text-accent">
                      {formatDate(t.openedAt)}
                    </Link>
                  </td>
                )}
                {col("symbol") && (
                  <td className="px-3 py-2 font-medium text-text">
                    <Link href={`/trades/${t.id}`} className="hover:text-accent">
                      {t.symbol}
                    </Link>
                  </td>
                )}
                {col("status") && (
                  <td className="px-3 py-2">
                    <StatusPill status={t.avgExitPrice == null ? "open" : t.netPnl >= 0 ? "win" : "loss"} />
                  </td>
                )}
                {col("side") && (
                  <td className="px-3 py-2 capitalize text-text-muted">{t.side}</td>
                )}
                {col("quantity") && (
                  <td className="px-3 py-2 text-text-muted">{t.quantity}</td>
                )}
                {col("avgEntryPrice") && (
                  <td className="px-3 py-2 text-text-muted">
                    {formatCurrency(t.avgEntryPrice, t.account.currency)}
                  </td>
                )}
                {col("avgExitPrice") && (
                  <td className="px-3 py-2 text-text-muted">
                    {t.avgExitPrice != null
                      ? formatCurrency(t.avgExitPrice, t.account.currency)
                      : "—"}
                  </td>
                )}
                {col("fees") && (
                  <td className="px-3 py-2 text-text-muted">
                    {formatCurrency(t.fees + t.commissions, t.account.currency)}
                  </td>
                )}
                {col("netPnl") && (
                  <td
                    className={cn(
                      "px-3 py-2 font-medium",
                      t.netPnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(t.netPnl, t.account.currency)}
                  </td>
                )}
                {col("netRoi") && (
                  <td
                    className={cn(
                      "px-3 py-2",
                      t.netRoi == null
                        ? "text-text-faint"
                        : t.netRoi >= 0
                          ? "text-profit"
                          : "text-loss",
                    )}
                  >
                    {t.netRoi != null ? formatPercent(t.netRoi) : "—"}
                  </td>
                )}
                {col("account") && (
                  <td className="px-3 py-2 text-text-muted">{t.account.name}</td>
                )}
                {col("tags") && (
                  <td className="px-3 py-2 text-text-muted">
                    {t.tags.map((tt) => tt.tag.name).join(", ") || "—"}
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      title="Split"
                      onClick={() => handleSplit(t.id, t.quantity)}
                      className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text"
                    >
                      <Split className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          try {
                            await deleteTrades([t.id]);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Failed to delete");
                          }
                        });
                      }}
                      className="rounded p-1.5 text-text-faint hover:bg-loss-bg hover:text-loss"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <span>
            Showing {pageRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {(currentPage - 1) * pageSize + pageRows.length} of {sorted.length} trades
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-text-muted outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "win" | "loss" | "open" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        status === "win" && "bg-profit-bg text-profit",
        status === "loss" && "bg-loss-bg text-loss",
        status === "open" && "bg-surface-3 text-text-muted",
      )}
    >
      {status === "open" ? "Open" : status === "win" ? "Win" : "Loss"}
    </span>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-3 py-2 font-medium",
        onClick && "cursor-pointer select-none hover:text-text",
      )}
    >
      {children}
    </th>
  );
}
