"use client";

import { api } from "@/trpc/client";
import { Card, CardContent } from "@/components/ui/card";

export default function OrdersPage() {
  const { data, isLoading, fetchNextPage, hasNextPage } =
    api.orders.list.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (last) => last.nextCursor }
    );

  const orders = data?.pages.flatMap((p) => p.orders) ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
        <p className="text-gray-500 mt-1">All synced Swiggy Instamart orders</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_: unknown, i: number) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🧾</p>
          <p className="font-semibold text-gray-900">No orders yet</p>
          <p className="text-gray-500 text-sm mt-1">Sync your Swiggy orders via the extension</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.orderedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {order.lineItems.length} items · ₹{order.totalAmountINR}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    Swiggy Instamart
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {order.lineItems.slice(0, 5).map((li: (typeof order.lineItems)[number]) => (
                    <div key={li.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{li.groceryItem.name}</span>
                      <span className="text-gray-500">
                        {li.quantityOrdered}× · ₹{li.priceINR}
                      </span>
                    </div>
                  ))}
                  {order.lineItems.length > 5 && (
                    <p className="text-xs text-gray-400">
                      +{order.lineItems.length - 5} more items
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {hasNextPage && (
            <button
              onClick={() => void fetchNextPage()}
              className="w-full py-3 text-sm text-brand-600 font-medium hover:text-brand-700"
            >
              Load more →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
