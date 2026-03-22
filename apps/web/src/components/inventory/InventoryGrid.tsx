"use client";

import { StockCard } from "./StockCard";
import type { StockLevel } from "@grocery-tracker/shared";

interface InventoryItem {
  id: string;
  groceryItemId: string;
  name: string;
  normalizedName: string;
  category: string;
  estimatedStockUnits: number;
  unitType: string;
  runoutPredictedAt: Date | null;
  daysUntilRunout: number | null;
  stockLevel: StockLevel;
  lastUpdatedAt: Date;
}

interface InventoryGridProps {
  items: InventoryItem[];
  filter?: "all" | "critical" | "low" | "ok";
}

export function InventoryGrid({ items, filter = "all" }: InventoryGridProps) {
  const filtered =
    filter === "all" ? items : items.filter((i) => i.stockLevel === filter);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📦</p>
        <p className="font-medium">No items found</p>
        <p className="text-sm mt-1">
          {filter === "all"
            ? "Sync your Swiggy orders to see inventory"
            : `No ${filter} stock items`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filtered.map((item) => (
        <StockCard key={item.id} {...item} />
      ))}
    </div>
  );
}
