"use client";

import { useState } from "react";
import { api } from "@/trpc/client";

export default function ShoppingListPage() {
  const { data: inventory = [], isLoading } = api.inventory.list.useQuery();
  const [copied, setCopied] = useState(false);

  const urgent = inventory.filter(
    (i) => i.stockLevel === "critical" || i.stockLevel === "low"
  );
  const critical = urgent.filter((i) => i.stockLevel === "critical");

  const textList = urgent
    .map((i) => `• ${i.name}${i.estimatedStockUnits > 0 ? ` (${Math.round(i.estimatedStockUnits)} ${i.unitType} left)` : ""}`)
    .join("\n");

  function handleCopy() {
    void navigator.clipboard.writeText(textList).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shopping List</h1>
        <p className="text-gray-500 mt-1">Everything you need to buy — critical and low stock items</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_: unknown, i: number) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : urgent.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-semibold text-gray-900">Nothing to buy right now</p>
          <p className="text-gray-500 text-sm mt-1">All your tracked items are well stocked.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {copied ? "✓ Copied!" : "📋 Copy list"}
            </button>
            {critical.length > 0 && (
              <a
                href={`https://blinkit.com/s/?q=${encodeURIComponent(critical[0]!.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Open Blinkit →
              </a>
            )}
          </div>

          {/* Critical items */}
          {critical.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                🚨 Critical — Reorder Now
              </h2>
              <div className="space-y-2">
                {critical.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.daysUntilRunout !== null && item.daysUntilRunout <= 0
                          ? "Out of stock"
                          : `${item.daysUntilRunout}d remaining`}
                      </p>
                    </div>
                    <a
                      href={`https://blinkit.com/s/?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-600 font-medium hover:text-brand-700"
                    >
                      Order →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low stock items */}
          {urgent.filter((i) => i.stockLevel === "low").length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                ⚠️ Running Low
              </h2>
              <div className="space-y-2">
                {urgent
                  .filter((i) => i.stockLevel === "low")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.daysUntilRunout}d remaining</p>
                      </div>
                      <a
                        href={`https://blinkit.com/s/?q=${encodeURIComponent(item.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-600 font-medium hover:text-brand-700"
                      >
                        Order →
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Plain text preview */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Plain text (for sharing)
            </h2>
            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-sans">
              {textList}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
