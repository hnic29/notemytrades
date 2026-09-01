"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { Group } from "@/lib/analytics/grouping";

export function GroupedBarChart({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-faint">
        No closed trades match these filters.
      </div>
    );
  }

  const data = groups.map((g) => ({ label: g.label, netPnl: g.stats.netPnl }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          formatter={(v) => [formatCurrency(Number(v)), "Net P&L"]}
        />
        <Bar dataKey="netPnl" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.netPnl >= 0 ? "#22c55e" : "#f43f5e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
