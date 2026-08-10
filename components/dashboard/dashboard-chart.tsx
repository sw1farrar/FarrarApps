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
import { formatCurrency } from "@/lib/format";

export function DashboardChart({
  data,
}: {
  data: { date: string; income: number; expense: number }[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No cash activity this month yet
      </div>
    );
  }

  // Compact axis labels: "Mar 5"
  const chartData = data.map((row) => {
    const parts = row.date.split("-");
    const label =
      parts.length === 3
        ? new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
          ).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : row.date;
    return { ...row, label };
  });

  return (
    <div className="h-48 w-full sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="dashIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dashExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            className="stroke-border"
            opacity={0.6}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
            className="fill-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatCurrency(Number(value ?? 0)),
              name === "income" ? "In" : "Out",
            ]}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="income"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#dashIncome)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="expense"
            stroke="var(--chart-5)"
            strokeWidth={2}
            strokeDasharray="4 3"
            fill="url(#dashExpense)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
