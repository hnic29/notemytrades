"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import {
  detectFormat,
  detectAggregateFormat,
  guessMapping,
  mapCsvRows,
  type AggregatePreset,
  type ColumnMapping,
  type FileRole,
  type ImportFile,
  type ParseResult,
} from "@/lib/import/csv";
import { bulkImportTrades, type BulkImportResult } from "@/lib/actions/trades";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccountOption = { id: string; name: string; currency: string };

const REQUIRED_FIELDS: { key: keyof ColumnMapping; label: string; optional?: boolean }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "quantity", label: "Quantity" },
  { key: "entryPrice", label: "Entry Price" },
  { key: "exitPrice", label: "Exit Price", optional: true },
  { key: "openedAt", label: "Opened At" },
  { key: "closedAt", label: "Closed At", optional: true },
  { key: "fees", label: "Fees", optional: true },
  { key: "commissions", label: "Commissions", optional: true },
  { key: "side", label: "Side (buy/sell/long/short)", optional: true },
];

const ASSET_TYPES = ["stock", "futures", "forex", "crypto", "option"];

const isCsv = (f: File) => /\.csv$/i.test(f.name) || f.type === "text/csv";

/**
 * Everything dropped onto the zone, with folders walked recursively so
 * a whole export folder can be dragged in as one gesture. Falls back to
 * the plain file list where the entries API isn't available.
 */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items ?? [])
    .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e != null);
  if (entries.length === 0) return Array.from(dt.files);

  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      out.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries hands back batches; keep going until an empty one.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        if (batch.length === 0) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [presetLabel, setPresetLabel] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [aggregatePreset, setAggregatePreset] = useState<AggregatePreset | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [assetType, setAssetType] = useState("stock");
  const [isPending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  // Column-mapped formats are single-file; the first one dropped is it.
  const primary = files[0];
  const headers = primary?.headers ?? [];
  const rows = primary?.rows ?? [];

  const parseFile = (file: File) =>
    new Promise<ImportFile>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) =>
          resolve({ name: file.name, headers: results.meta.fields ?? [], rows: results.data }),
        error: (err) => reject(err),
      });
    });

  const handleFiles = async (incoming: File[]) => {
    setError(null);
    // Only CSVs are worth parsing; a dragged-in folder brings whatever
    // else lives there along for the ride.
    const csvs = incoming.filter(isCsv).filter((f) => !files.some((p) => p.name === f.name));
    if (csvs.length === 0) {
      if (incoming.length > 0 && files.length === 0) setError("No CSV files found in what you dropped.");
      return;
    }
    let parsedFiles: ImportFile[];
    try {
      parsedFiles = await Promise.all(csvs.map(parseFile));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read file");
      return;
    }
    const all = [...files, ...parsedFiles];
    setFiles(all);

    // Some brokers spread one import across several exports; any file
    // matching an aggregate preset switches the whole batch to it, and
    // there's no column mapping to configure.
    const aggregate = all.map((f) => detectAggregateFormat(f.headers)).find(Boolean) ?? null;
    if (aggregate) {
      setAggregatePreset(aggregate);
      setPresetLabel(null);
      setMapping(null);
      const suggested = aggregate.aggregate(all).suggestedAssetType;
      if (suggested) setAssetType(suggested);
      return;
    }
    setAggregatePreset(null);

    const hdrs = all[0].headers;
    const preset = detectFormat(hdrs);
    const empty: ColumnMapping = {
      symbol: "",
      quantity: "",
      entryPrice: "",
      exitPrice: null,
      openedAt: "",
      closedAt: null,
      fees: null,
      commissions: null,
      side: null,
      defaultSide: "long",
    };
    if (preset) {
      setPresetLabel(preset.label);
      setMapping({ ...empty, ...preset.mapping(hdrs) });
    } else {
      setPresetLabel(null);
      setMapping({ ...empty, ...guessMapping(hdrs) });
    }
  };

  const reset = () => {
    setFiles([]);
    setMapping(null);
    setAggregatePreset(null);
    setPresetLabel(null);
  };

  const parsed: ParseResult | null = useMemo(() => {
    if (files.length === 0) return null;
    if (aggregatePreset) return aggregatePreset.aggregate(files);
    if (!mapping) return null;
    return mapCsvRows(files[0].rows, mapping);
  }, [mapping, files, aggregatePreset]);

  const handleImport = () => {
    if (!parsed || parsed.trades.length === 0 || !accountId) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await bulkImportTrades(
          accountId,
          assetType,
          aggregatePreset?.id ?? primary?.name.replace(/\.[^.]+$/, "") ?? "generic",
          parsed.trades,
        );
        setImportResult(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      }
    });
  };

  if (importResult != null) {
    const importedCount = importResult.imported;
    const nothingNew = importedCount === 0 && importResult.duplicates > 0;
    // Stats describe what actually landed; a re-import of an already
    // imported window shouldn't re-report the same P&L as if it were new.
    const importStats =
      parsed &&
      importedCount > 0 &&
      computeSummaryStats(
        parsed.trades.map((t) => ({
          netPnl: t.netPnl,
          openedAt: new Date(t.openedAt),
          closedAt: t.closedAt ? new Date(t.closedAt) : null,
        })),
      );

    return (
      <div
        className={
          nothingNew
            ? "rounded-lg border border-border bg-surface p-6"
            : "rounded-lg border border-profit/40 bg-profit-bg p-6"
        }
      >
        <p className={`text-center text-lg font-medium ${nothingNew ? "text-text" : "text-profit"}`}>
          {nothingNew
            ? "Nothing new to import"
            : `Imported ${importedCount} trade${importedCount === 1 ? "" : "s"}`}
        </p>
        {importResult.duplicates > 0 && (
          <p className="mt-1 text-center text-sm text-text-muted">
            {importResult.duplicates} already in this account — skipped, not duplicated.
          </p>
        )}

        {importStats && importStats.closedTrades > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ImportStat
              label="Net P&L"
              value={formatCurrency(importStats.netPnl, account?.currency ?? "USD")}
              tone={importStats.netPnl >= 0 ? "profit" : "loss"}
            />
            <ImportStat
              label="Win Rate"
              value={importStats.winRate != null ? formatPercent(importStats.winRate) : "—"}
            />
            <ImportStat
              label="Profit Factor"
              value={importStats.profitFactor != null ? importStats.profitFactor.toFixed(2) : "—"}
            />
            <ImportStat label="Wins / Losses" value={`${importStats.wins} / ${importStats.losses}`} />
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/trades")}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
          >
            Go to Trade Log
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {files.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(await filesFromDrop(e.dataTransfer));
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed py-14 text-center transition-colors",
            dragging ? "border-accent bg-accent/5" : "border-border-strong",
          )}
        >
          <Upload className="h-8 w-8 text-text-faint" />
          <p className="text-sm text-text">Drop your broker export files here</p>
          <p className="max-w-md text-xs text-text-faint">
            Select everything the export gave you — files are recognized by their contents, the
            ones that aren&apos;t needed are ignored, and trades already in your journal are never
            duplicated.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <label className="cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong">
              Choose files
              <input
                type="file"
                accept=".csv,text/csv"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
              />
            </label>
            <label className="cursor-pointer rounded-md border border-border px-4 py-2 text-sm text-text-muted hover:border-border-strong hover:text-text">
              Choose a folder
              <input
                type="file"
                multiple
                className="hidden"
                {...({ webkitdirectory: "" } as object)}
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
              />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      {headers.length > 0 && (mapping || aggregatePreset) && (
        <>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-4 py-3 text-sm">
            <span className="flex min-w-0 flex-col gap-2 text-text-muted">
              {(presetLabel || aggregatePreset) && (
                <span className="self-start rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  Detected: {presetLabel ?? aggregatePreset?.label}
                </span>
              )}
              {aggregatePreset ? (
                <span className="flex flex-col gap-1">
                  {(parsed?.files ?? files.map((f): FileRole => ({ name: f.name, role: f.name, used: true }))).map(
                    (f) => (
                      <span key={f.name} className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs",
                            f.used ? "bg-profit/15 text-profit" : "bg-surface-2 text-text-faint",
                          )}
                        >
                          {f.role}
                        </span>
                        <span className={cn("truncate", !f.used && "text-text-faint")}>{f.name}</span>
                        {f.note && <span className="shrink-0 text-xs text-text-faint">· {f.note}</span>}
                      </span>
                    ),
                  )}
                </span>
              ) : (
                <>
                  {primary.name} · {rows.length} row{rows.length === 1 ? "" : "s"}
                </>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {aggregatePreset && (
                <label className="cursor-pointer text-accent hover:underline">
                  Add file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                  />
                </label>
              )}
              <button onClick={reset} className="text-text-faint hover:text-text">
                Start over
              </button>
            </span>
          </div>

          {aggregatePreset && (
            <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-muted">
              {aggregatePreset.description} There&apos;s no column mapping to configure for this
              format.
            </p>
          )}

          {parsed?.warnings && parsed.warnings.length > 0 && (
            <ul className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              {parsed.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-muted">
                Import into Account
              </span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={selectClass}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-muted">Asset Type</span>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className={selectClass}
              >
                {ASSET_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mapping && (
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-text">Map Columns</h2>
            <div className="grid grid-cols-2 gap-3">
              {REQUIRED_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs text-text-muted">
                    {f.label}
                    {f.optional && <span className="text-text-faint"> (optional)</span>}
                  </span>
                  <select
                    value={(mapping[f.key] as string | null) ?? ""}
                    onChange={(e) =>
                      mapping &&
                      setMapping({
                        ...mapping,
                        [f.key]: e.target.value || null,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="">— not present —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">
                  Default side when not mapped above
                </span>
                <select
                  value={mapping.defaultSide}
                  onChange={(e) =>
                    setMapping({ ...mapping, defaultSide: e.target.value as "long" | "short" })
                  }
                  className={selectClass}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
            </div>
          </div>
          )}

          {parsed && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-text">
                  Preview — {parsed.trades.length} trade{parsed.trades.length === 1 ? "" : "s"}{" "}
                  ready
                  {parsed.errors.length > 0 && (
                    <span className="ml-2 text-loss">
                      · {parsed.errors.length} row{parsed.errors.length === 1 ? "" : "s"} skipped
                    </span>
                  )}
                </h2>
              </div>

              {parsed.trades.length > 0 && (
                <div className="max-h-64 overflow-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface-2 text-text-faint">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Symbol</th>
                        <th className="px-2 py-1.5 text-left">Side</th>
                        <th className="px-2 py-1.5 text-left">Qty</th>
                        <th className="px-2 py-1.5 text-left">Entry</th>
                        <th className="px-2 py-1.5 text-left">Exit</th>
                        <th className="px-2 py-1.5 text-left">Net P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.trades.slice(0, 20).map((t, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5 text-text">{t.symbol}</td>
                          <td className="px-2 py-1.5 capitalize text-text-muted">{t.side}</td>
                          <td className="px-2 py-1.5 text-text-muted">{t.quantity}</td>
                          <td className="px-2 py-1.5 text-text-muted">{t.avgEntryPrice}</td>
                          <td className="px-2 py-1.5 text-text-muted">
                            {t.avgExitPrice ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-2 py-1.5 font-medium",
                              t.netPnl >= 0 ? "text-profit" : "text-loss",
                            )}
                          >
                            {formatCurrency(t.netPnl, account?.currency ?? "USD")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.trades.length > 20 && (
                    <div className="px-2 py-1.5 text-text-faint">
                      …and {parsed.trades.length - 20} more
                    </div>
                  )}
                </div>
              )}

              {parsed.errors.length > 0 && (
                <ul className="mt-3 max-h-32 space-y-0.5 overflow-auto text-xs text-loss">
                  {parsed.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={handleImport}
                disabled={isPending || parsed.trades.length === 0 || !accountId}
                className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {isPending ? "Importing…" : `Import ${parsed.trades.length} Trades`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const selectClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";

function ImportStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-center">
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
