"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { StockLevel } from "@grocery-tracker/shared";

interface StockCardProps {
  name: string;
  category: string;
  estimatedStockUnits: number;
  unitType: string;
  daysUntilRunout: number | null;
  stockLevel: StockLevel;
  lastUpdatedAt: Date;
  onReorder?: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  DAIRY: "🥛",
  PRODUCE: "🥦",
  GRAINS: "🌾",
  BEVERAGES: "☕",
  SNACKS: "🍪",
  PERSONAL_CARE: "🧴",
  CLEANING: "🧹",
  FROZEN: "❄️",
  CONDIMENTS: "🫙",
  OTHER: "🛒",
};

export function StockCard({
  name,
  category,
  estimatedStockUnits,
  unitType,
  daysUntilRunout,
  stockLevel,
  lastUpdatedAt,
  onReorder,
}: StockCardProps) {
  const emoji = CATEGORY_EMOJI[category] ?? "🛒";

  const barColor =
    stockLevel === "critical"
      ? "bg-red-500"
      : stockLevel === "low"
        ? "bg-amber-500"
        : "bg-green-500";

  const barWidth =
    daysUntilRunout === null
      ? 50
      : Math.min(100, Math.max(5, (daysUntilRunout / 14) * 100));

  const badgeVariant: "critical" | "low" | "ok" | "unknown" =
    stockLevel === "critical" || stockLevel === "low" || stockLevel === "ok" || stockLevel === "unknown"
      ? stockLevel
      : "unknown";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate text-sm">{name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {estimatedStockUnits.toFixed(0)} {unitType} remaining
              </p>
            </div>
          </div>
          <Badge variant={badgeVariant}>
            {daysUntilRunout !== null
              ? daysUntilRunout <= 0
                ? "Out!"
                : `${daysUntilRunout}d`
              : "?"}
          </Badge>
        </div>

        {/* Stock bar */}
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Updated {new Date(lastUpdatedAt).toLocaleDateString("en-IN")}
          </span>
          {stockLevel === "critical" && onReorder && (
            <button
              onClick={onReorder}
              className="text-xs text-brand-600 font-medium hover:text-brand-700"
            >
              Reorder →
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
