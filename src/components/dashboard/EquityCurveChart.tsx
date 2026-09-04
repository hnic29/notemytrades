"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/analytics/stats";
import { formatDashboardValue, formatDate, type DashboardViewMode } from "@/lib/format";

export function EquityCurveChart({
  data,
  viewMode = "dollars",
  startingBalance = 0,
}: {
  data: EquityPoint[];
  /** Only the dashboard cares about this — other callers (Reports,
   * Backtesting) just get plain dollar formatting. */
  viewMode?: DashboardViewMode;
  startingBalance?: number;
}) {
  const format = (v: number) => formatDashboardValue(v, viewMode, startingBalance);

  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-text-faint">
        Not enough closed trades yet to plot an equity curve.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232c40" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#5c6a85", fontSize: 11 }}
          tickFormatter={(v) => formatDate(v)}
          axisLine={{ stroke: "#232c40" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: "#5c6a85", fontSize: 11 }}
          tickFormatter={(v) => format(v)}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{
            background: "#1a2233",
            border: "1px solid #232c40",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => (v ? formatDate(String(v)) : "")}
          formatter={(v) => [format(Number(v)), "Equity"]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#2dd4bf"
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
