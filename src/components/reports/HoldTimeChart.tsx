"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { HoldTimeBucket } from "@/lib/analytics/detailed-stats";

export function HoldTimeChart({ buckets }: { buckets: HoldTimeBucket[] }) {
  const hasData = buckets.some((b) => b.count > 0);
  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-faint">
        No closed trades match these filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-medium text-text-faint">Trades by Hold Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#232c40" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#5c6a85", fontSize: 10 }}
              axisLine={{ stroke: "#232c40" }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fill: "#5c6a85", fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#1a2233", border: "1px solid #232c40", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${v}`, "Trades"]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#2dd4bf" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium text-text-faint">Net P&L by Hold Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#232c40" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#5c6a85", fontSize: 10 }}
              axisLine={{ stroke: "#232c40" }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: "#5c6a85", fontSize: 11 }}
              tickFormatter={(v) => formatCurrency(v)}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={{ background: "#1a2233", border: "1px solid #232c40", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [formatCurrency(Number(v)), "Net P&L"]}
            />
            <Bar dataKey="netPnl" radius={[3, 3, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={b.netPnl >= 0 ? "#22c55e" : "#f43f5e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
