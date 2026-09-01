"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { detectFormat, guessMapping, mapCsvRows, type ColumnMapping } from "@/lib/import/csv";
import { bulkImportTrades } from "@/lib/actions/trades";
import { formatCurrency } from "@/lib/format";
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

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [presetLabel, setPresetLabel] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [assetType, setAssetType] = useState("stock");
  const [isPending, startTransition] = useTransition();
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);

  const handleFile = (file: File) => {
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const hdrs = results.meta.fields ?? [];
        setHeaders(hdrs);
        setRows(results.data);

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
      },
      error: (err) => setError(err.message),
    });
  };

  const parsed = useMemo(() => {
    if (!mapping || rows.length === 0) return null;
    return mapCsvRows(rows, mapping);
  }, [mapping, rows]);

  const handleImport = () => {
    if (!parsed || parsed.trades.length === 0 || !accountId) return;
    setError(null);
    startTransition(async () => {
      try {
        const count = await bulkImportTrades(
          accountId,
          assetType,
          fileName?.replace(/\.[^.]+$/, "") || "generic",
          parsed.trades,
        );
        setImportedCount(count);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      }
    });
  };

  if (importedCount != null) {
    return (
      <div className="rounded-lg border border-profit/40 bg-profit-bg p-6 text-center">
        <p className="text-lg font-medium text-profit">
          Imported {importedCount} trade{importedCount === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => router.push("/trades")}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          Go to Trade Log
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!headers.length && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong py-16 text-center hover:border-accent/50">
          <Upload className="h-8 w-8 text-text-faint" />
          <span className="text-sm text-text-muted">
            Click to choose a CSV file exported from your broker
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      {error && (
        <div className="rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      {headers.length > 0 && mapping && (
        <>
          <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-text-muted">
              {fileName} · {rows.length} row{rows.length === 1 ? "" : "s"}
              {presetLabel && (
                <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  Detected: {presetLabel}
                </span>
              )}
            </span>
            <button
              onClick={() => {
                setHeaders([]);
                setRows([]);
                setMapping(null);
                setFileName(null);
              }}
              className="text-text-faint hover:text-text"
            >
              Choose a different file
            </button>
          </div>

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
