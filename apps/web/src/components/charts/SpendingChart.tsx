"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  DAIRY:        "#3b82f6",
  PRODUCE:      "#22c55e",
  GRAINS:       "#f59e0b",
  BEVERAGES:    "#8b5cf6",
  SNACKS:       "#ec4899",
  PERSONAL_CARE:"#06b6d4",
  CLEANING:     "#64748b",
  FROZEN:       "#0ea5e9",
  CONDIMENTS:   "#f97316",
  OTHER:        "#a1a1aa",
};

interface Props {
  data: Array<Record<string, string | number>>;
}

export function SpendingChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No spending data yet — sync your orders to see analytics.
      </div>
    );
  }

  // Collect all categories present in data
  const categories = Array.from(
    new Set(data.flatMap((row) => Object.keys(row).filter((k) => k !== "month")))
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          tick={{ fontSize: 12 }}
          width={52}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            `₹${Number(value).toLocaleString("en-IN")}`,
            String(name).charAt(0) + String(name).slice(1).toLowerCase(),
          ]}
        />
        <Legend formatter={(name: unknown) => String(name).charAt(0) + String(name).slice(1).toLowerCase()} />
        {categories.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={CATEGORY_COLORS[cat] ?? "#a1a1aa"}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
