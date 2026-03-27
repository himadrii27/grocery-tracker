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
  Cell,
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  DAIRY:         "#3b82f6", // blue
  PRODUCE:       "#22c55e", // green
  GRAINS:        "#f59e0b", // amber
  BEVERAGES:     "#8b5cf6", // violet
  SNACKS:        "#ec4899", // pink
  PERSONAL_CARE: "#06b6d4", // cyan
  CLEANING:      "#64748b", // slate
  FROZEN:        "#0ea5e9", // sky
  CONDIMENTS:    "#f97316", // orange
  OTHER:         "#d1d5db", // light grey — less visually dominant
};

// "PERSONAL_CARE" → "Personal Care"
function formatCategory(raw: unknown): string {
  return String(raw)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ₹1700 → "₹1.7k", ₹850 → "₹850"
function formatRupees(v: number): string {
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${v}`;
}

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

  const categories = Array.from(
    new Set(data.flatMap((row) => Object.keys(row).filter((k) => k !== "month")))
  );

  // Sort so OTHER always renders at the bottom of the stack (least interesting)
  const sorted = [
    ...categories.filter((c) => c !== "OTHER"),
    ...categories.filter((c) => c === "OTHER"),
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        barCategoryGap="35%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatRupees}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "#f9fafb" }}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontSize: "13px",
          }}
          formatter={(value: unknown, name: unknown) => [
            `₹${Number(value).toLocaleString("en-IN")}`,
            formatCategory(name),
          ]}
        />
        <Legend
          verticalAlign="top"
          align="left"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingBottom: "16px", fontSize: "12px", color: "#374151" }}
          formatter={formatCategory}
        />
        {sorted.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={CATEGORY_COLORS[cat] ?? "#a1a1aa"}
            radius={cat === sorted[sorted.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
