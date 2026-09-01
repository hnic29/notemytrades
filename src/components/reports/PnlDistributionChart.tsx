"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PnlBucket } from "@/lib/analytics/stats";

export function PnlDistributionChart({ buckets }: { buckets: PnlBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-faint">
        No closed trades match these filters.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232c40" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#5c6a85", fontSize: 10 }}
          axisLine={{ stroke: "#232c40" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#5c6a85", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: "#1a2233",
            border: "1px solid #232c40",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => [`${v}`, "Trades"]}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {buckets.map((b, i) => (
            <Cell key={i} fill={b.midpoint >= 0 ? "#22c55e" : "#f43f5e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
