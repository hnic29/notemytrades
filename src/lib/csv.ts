import Papa from "papaparse";

/**
 * Turns an array of flat row objects into a CSV file the browser
 * downloads immediately — the Papa.unparse + Blob + anchor-click dance
 * every CSV export in the app needs, extracted here so a second
 * consumer (backtesting) doesn't re-copy it a second time.
 */
export function downloadCsv(filename: string, rows: object[]): void {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
