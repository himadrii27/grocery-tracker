"use client";

import { useState } from "react";
import { api } from "@/trpc/client";
import { InventoryGrid } from "@/components/inventory/InventoryGrid";

type FilterTab = "all" | "critical" | "low" | "ok";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical 🚨" },
  { value: "low", label: "Low ⚠️" },
  { value: "ok", label: "OK ✅" },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const { data: items = [], isLoading } = api.inventory.list.useQuery();

  type InventoryItem = (typeof items)[number];
  const counts = {
    all: items.length,
    critical: items.filter((i: InventoryItem) => i.stockLevel === "critical").length,
    low: items.filter((i: InventoryItem) => i.stockLevel === "low").length,
    ok: items.filter((i: InventoryItem) => i.stockLevel === "ok").length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 mt-1">All tracked grocery items</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}{" "}
            <span className="ml-1 opacity-70">({counts[tab.value]})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_: unknown, i: number) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <InventoryGrid items={items as Parameters<typeof InventoryGrid>[0]["items"]} filter={activeTab} />
      )}
    </div>
  );
}
