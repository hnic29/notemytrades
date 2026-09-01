"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

export type IntradayPoint = { time: string; cumulative: number; label: string };

export function IntradayPnlChart({ points }: { points: IntradayPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-faint">
        No closed trades this day yet.
      </div>
    );
  }

  const isPositive = points[points.length - 1].cumulative >= 0;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="intradayFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={isPositive ? "#22c55e" : "#f43f5e"}
              stopOpacity={0.35}
            />
            <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#f43f5e"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232c40" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#5c6a85", fontSize: 11 }}
          axisLine={{ stroke: "#232c40" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#5c6a85", fontSize: 11 }}
          tickFormatter={(v) => formatCurrency(v)}
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
          formatter={(v) => [formatCurrency(Number(v)), "Cumulative P&L"]}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={isPositive ? "#22c55e" : "#f43f5e"}
          strokeWidth={2}
          fill="url(#intradayFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
