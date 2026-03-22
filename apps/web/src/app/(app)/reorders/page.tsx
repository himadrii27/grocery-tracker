"use client";

import { api } from "@/trpc/client";
import { ReorderCard } from "@/components/reorders/ReorderCard";

export default function ReordersPage() {
  const utils = api.useUtils();
  const { data: reorders = [], isLoading } = api.reorders.list.useQuery({});

  const confirmMutation = api.reorders.confirmDeepLink.useMutation({
    onSuccess: () => void utils.reorders.list.invalidate(),
  });
  const skipMutation = api.reorders.skip.useMutation({
    onSuccess: () => void utils.reorders.list.invalidate(),
  });

  type ReorderItem = (typeof reorders)[number];
  const pending = reorders.filter((r: ReorderItem) => r.status === "LINK_GENERATED");
  const skipped = reorders.filter((r: ReorderItem) => r.status === "SKIPPED");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reorder Suggestions</h1>
        <p className="text-gray-500 mt-1">AI-generated reorder suggestions with one-tap links</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_: unknown, i: number) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pending.length === 0 && skipped.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-semibold text-gray-900">All caught up!</p>
          <p className="text-gray-500 text-sm mt-1">
            No reorder suggestions right now. Check back tomorrow.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Action Needed
              </h2>
              {pending.map((r: ReorderItem) => (
                <ReorderCard
                  key={r.id}
                  id={r.id}
                  itemName={r.groceryItem.name}
                  platform={r.platform}
                  quantityOrdered={r.quantityOrdered}
                  deepLink={r.deepLink}
                  reasoning={(r.agentTrace as { reasoning?: string } | null)?.reasoning ?? "Low stock detected."}
                  status={r.status}
                  onConfirm={(id) => confirmMutation.mutate({ id })}
                  onSkip={(id) => skipMutation.mutate({ id })}
                  isLoading={confirmMutation.isPending || skipMutation.isPending}
                />
              ))}
            </>
          )}

          {skipped.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mt-6">
                Skipped
              </h2>
              {skipped.map((r: ReorderItem) => (
                <ReorderCard
                  key={r.id}
                  id={r.id}
                  itemName={r.groceryItem.name}
                  platform={r.platform}
                  quantityOrdered={r.quantityOrdered}
                  deepLink={r.deepLink}
                  reasoning={(r.agentTrace as { reasoning?: string } | null)?.reasoning ?? ""}
                  status={r.status}
                  onConfirm={(id) => confirmMutation.mutate({ id })}
                  onSkip={(id) => skipMutation.mutate({ id })}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
