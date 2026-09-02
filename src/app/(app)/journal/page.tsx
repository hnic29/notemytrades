import Link from "next/link";
import { getDailyNote, getTradesForDate } from "@/lib/queries/journal";
import { JournalDateNav } from "@/components/journal/JournalDateNav";
import { DailyNoteEditor } from "@/components/journal/DailyNoteEditor";
import { IntradayPnlChart, type IntradayPoint } from "@/components/journal/IntradayPnlChart";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { localDayRange, todayLocalKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

export default async function JournalPage(props: PageProps<"/journal">) {
  const searchParams = await props.searchParams;
  const dateKey = typeof searchParams.date === "string" ? searchParams.date : todayLocalKey();

  const [trades, note] = await Promise.all([
    getTradesForDate(dateKey),
    getDailyNote(dateKey),
  ]);

  // getTradesForDate returns everything that *touches* this day (opened
  // today, closed today, or both) so the table has full context — but
  // "Day net P&L" must only count trades that actually closed today, or
  // it won't match the calendar cell this page was linked from (which
  // groups purely by close day, same as computeDailyPnl everywhere else).
  const { start: dayStart, end: dayEnd } = localDayRange(dateKey);
  const closed = trades
    .filter((t) => t.closedAt && t.closedAt >= dayStart && t.closedAt <= dayEnd)
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  const intradayPoints: IntradayPoint[] = closed.reduce<IntradayPoint[]>((points, t) => {
    const cumulative = (points.at(-1)?.cumulative ?? 0) + t.netPnl;
    points.push({
      time: t.closedAt!.toISOString(),
      cumulative,
      label: t.closedAt!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
    return points;
  }, []);

  const dayNetPnl = closed.reduce((sum, t) => sum + t.netPnl, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">Daily Journal</h1>
        <JournalDateNav dateKey={dateKey} />
      </div>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          No trades on this day.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-text-muted">Day net P&L:</span>
            <span
              className={cn(
                "text-lg font-semibold",
                dayNetPnl >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {formatCurrency(dayNetPnl)}
            </span>
            <span className="text-sm text-text-faint">
              · {trades.length} trade{trades.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mb-6 rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-medium text-text-muted">
              Intraday Cumulative P&L
            </h2>
            <IntradayPnlChart points={intradayPoints} />
          </div>

          <div className="mb-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-text-faint">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Net P&L</th>
                  <th className="px-3 py-2">Account</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-3 py-2 text-text-muted">{formatDateTime(t.openedAt)}</td>
                    <td className="px-3 py-2 font-medium text-text">
                      <Link href={`/trades/${t.id}`} className="hover:text-accent">
                        {t.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2 capitalize text-text-muted">{t.side}</td>
                    <td className="px-3 py-2 text-text-muted">{t.quantity}</td>
                    <td
                      className={cn(
                        "px-3 py-2 font-medium",
                        t.netPnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {formatCurrency(t.netPnl, t.account.currency)}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{t.account.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium text-text-muted">Notes</h2>
        <DailyNoteEditor dateKey={dateKey} initialText={note?.contentJson ?? ""} />
      </div>
    </div>
  );
}
