"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDashboardValue, formatDate, type DashboardViewMode } from "@/lib/format";

export function DrawdownChart({
  data,
  viewMode = "dollars",
  startingBalance = 0,
}: {
  data: { date: string; drawdown: number }[];
  /** Only the dashboard cares about this — other callers (Reports)
   * just get plain dollar formatting. */
  viewMode?: DashboardViewMode;
  startingBalance?: number;
}) {
  const format = (v: number) => formatDashboardValue(v, viewMode, startingBalance);

  if (data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-faint">
        Not enough closed trades yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.35} />
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
          formatter={(v) => [format(Number(v)), "Drawdown"]}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#ddFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
