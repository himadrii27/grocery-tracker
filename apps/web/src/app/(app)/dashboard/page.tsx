import { api } from "@/trpc/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpendingChartWrapper as SpendingChart } from "@/components/charts/SpendingChartWrapper";
import Link from "next/link";

export default async function DashboardPage() {
  const [inventory, reorders, spending] = await Promise.all([
    api.inventory.list(),
    api.reorders.list({ status: "LINK_GENERATED", limit: 5 }),
    api.orders.spendingByCategory({ months: 6 }),
  ]);

  type InventoryItem = (typeof inventory)[number];
  const critical = inventory.filter((i: InventoryItem) => i.stockLevel === "critical");
  const low = inventory.filter((i: InventoryItem) => i.stockLevel === "low");
  const ok = inventory.filter((i: InventoryItem) => i.stockLevel === "ok");
  const unknown = inventory.filter((i: InventoryItem) => i.stockLevel === "unknown");

  const categoryIcon: Record<string, string> = {
    DAIRY: "🥛", PRODUCE: "🥦", GRAINS: "🌾", BEVERAGES: "🧃",
    SNACKS: "🍿", PERSONAL_CARE: "🧴", CLEANING: "🧹",
    FROZEN: "🧊", CONDIMENTS: "🫙", OTHER: "🛒",
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your grocery stock at a glance</p>
      </div>

      {inventory.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🛒</p>
          <h2 className="text-xl font-semibold text-gray-900">No inventory yet</h2>
          <p className="text-gray-500 mt-2 max-w-sm mx-auto">
            Sync your Swiggy Instamart or Blinkit orders using the Chrome extension.
          </p>
          <div className="mt-6 inline-block text-left bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 max-w-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">How to sync:</p>
            <ol className="space-y-2 text-sm text-gray-600">
              <li>1. Click the 🛒 Grocery Tracker icon in Chrome toolbar</li>
              <li>2. Click <strong>Connect Account</strong> if not connected</li>
              <li>3. Click <strong>Sync from Swiggy</strong> or <strong>Sync from Blinkit</strong></li>
              <li>4. Come back here — your inventory will appear</li>
            </ol>
          </div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Critical</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{critical.length}</p>
                <p className="text-xs text-gray-400 mt-1">Reorder now</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Running Low</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{low.length}</p>
                <p className="text-xs text-gray-400 mt-1">Order within 3 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Well Stocked</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{ok.length}</p>
                <p className="text-xs text-gray-400 mt-1">No action needed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-3xl font-bold text-gray-700 mt-1">{inventory.length}</p>
                <p className="text-xs text-gray-400 mt-1">Tracked</p>
              </CardContent>
            </Card>
          </div>

          {/* Critical items */}
          {critical.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                🚨 Reorder Now <Badge variant="critical">{critical.length}</Badge>
              </h2>
              <div className="space-y-2">
                {critical.map((item: InventoryItem) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.daysUntilRunout !== null && item.daysUntilRunout <= 0
                          ? "Out of stock" : `${item.daysUntilRunout}d remaining`}
                      </p>
                    </div>
                    <a
                      href={`https://blinkit.com/s/?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-600 font-medium hover:text-brand-700"
                    >
                      Order on Blinkit →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low stock */}
          {low.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                ⚠️ Running Low <Badge variant="low">{low.length}</Badge>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {low.slice(0, 6).map((item: InventoryItem) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="font-medium text-sm text-gray-900">{item.name}</p>
                    <Badge variant="low">{item.daysUntilRunout}d</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All inventory items (shown when no critical/low, or as full list) */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              📦 All Tracked Items
              <span className="text-sm font-normal text-gray-400">({inventory.length})</span>
              {unknown.length > 0 && (
                <span className="text-xs text-gray-400 ml-auto">
                  {unknown.length} item{unknown.length !== 1 ? "s" : ""} pending prediction
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {inventory.map((item: InventoryItem) => (
                <div key={item.id} className={`p-3 rounded-xl border ${
                  item.stockLevel === "critical" ? "bg-red-50 border-red-200" :
                  item.stockLevel === "low" ? "bg-amber-50 border-amber-200" :
                  item.stockLevel === "ok" ? "bg-green-50 border-green-200" :
                  "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{categoryIcon[item.category] ?? "🛒"}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.estimatedStockUnits > 0
                          ? `${Math.round(item.estimatedStockUnits)} ${item.unitType} remaining`
                          : "qty tracked"}
                      </p>
                      {item.daysUntilRunout !== null ? (
                        <p className={`text-xs mt-1 font-medium ${
                          item.stockLevel === "critical" ? "text-red-600" :
                          item.stockLevel === "low" ? "text-amber-600" : "text-green-600"
                        }`}>
                          {item.daysUntilRunout <= 0 ? "Out of stock" : `~${item.daysUntilRunout}d left`}
                        </p>
                      ) : (
                        <p className="text-xs mt-1 text-gray-400">Estimating…</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent reorder suggestions */}
          {reorders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-base font-semibold text-gray-900 mb-3">🔄 Recent Reorder Suggestions</h2>
              <div className="space-y-2">
                {reorders.slice(0, 3).map((r: (typeof reorders)[number]) => (
                  <div key={r.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{r.groceryItem.name}</p>
                      <p className="text-sm text-gray-500">Qty {r.quantityOrdered}</p>
                    </div>
                    <a href={r.deepLink} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-brand-600 font-medium hover:text-brand-700">
                      Reorder →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spending analytics chart */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3">📊 Spending by Category (last 6 months)</h2>
            <Card>
              <CardContent className="p-5">
                <SpendingChart data={spending} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
