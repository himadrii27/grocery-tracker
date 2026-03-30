import { inngest } from "./inngest-client";
import { db } from "@grocery-tracker/db";

/**
 * Post-sync prediction refresh.
 * Fires when orders are synced from the extension.
 * Uses heuristic shelf-life estimates (no AI cost) to immediately
 * update runoutPredictedAt for every item the user owns.
 */
export const postSyncPredictionsJob = inngest.createFunction(
  { id: "post_sync_predictions", name: "Post-Sync Prediction Refresh" },
  { event: "grocery/orders.synced" },
  async ({ event, step, logger }) => {
    const { userId } = event.data;

    const result = await step.run("refresh-heuristic-predictions", async () => {
      return runHeuristicPredictions(userId);
    });

    logger.info(`Post-sync predictions done for user ${userId}:`, result);
    return result;
  }
);

// ─── Non-consumable detection ──────────────────────────────────────────────────

const NON_CONSUMABLE_PATTERNS = [
  /vase/i, /lamp/i, /\blight\b/i, /bulb/i, /pixel light/i,
  /mattress/i, /foldable/i, /pillow/i, /blanket/i, /towel/i,
  /shorts/i, /underskirt/i, /claw clip/i, /hair clip/i, /scrunchie/i,
  /party glass/i, /\bglass(es)?\b/i, /tumbler/i, /\bmug\b/i,
  /decorative/i, /\bdecor\b/i, /figurine/i, /showpiece/i,
  /cable/i, /charger/i, /\bstand\b/i, /\brack\b/i, /\bbasket\b/i,
  /\bframe\b/i, /\bmirror\b/i, /hangers?/i, /hooks?/i,
  /notebook/i, /diary/i, /stationery/i,
  /\bclip\b/i,
  /femmora/i,
];

// Category → shelf-life in days (same values as seed-predictions.mjs)
const SHELF_LIFE: Record<string, number | null> = {
  PRODUCE:       4,
  DAIRY:         7,
  FROZEN:        30,
  GRAINS:        45,
  BEVERAGES:     30,
  SNACKS:        21,
  CONDIMENTS:    60,
  PERSONAL_CARE: 75,
  CLEANING:      45,
  OTHER:         null,
};

export async function runHeuristicPredictions(userId: string) {
  const items = await db.inventoryItem.findMany({
    where: { userId },
    include: { groceryItem: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const name = item.groceryItem.name;
    const category = item.groceryItem.category as string;

    // Non-consumables → clear prediction
    if (NON_CONSUMABLE_PATTERNS.some((re) => re.test(name))) {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { runoutPredictedAt: null },
      });
      skipped++;
      continue;
    }

    const shelfDays = SHELF_LIFE[category] ?? null;
    if (shelfDays === null) {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { runoutPredictedAt: null },
      });
      skipped++;
      continue;
    }

    // Most recent purchase
    const lastPurchase = await db.orderLineItem.findFirst({
      where: { groceryItemId: item.groceryItemId, order: { userId } },
      include: { order: true },
      orderBy: { order: { orderedAt: "desc" } },
    });

    if (!lastPurchase) { skipped++; continue; }

    // If multiple purchases, blend actual interval with category default
    const allPurchases = await db.orderLineItem.findMany({
      where: { groceryItemId: item.groceryItemId, order: { userId } },
      include: { order: true },
      orderBy: { order: { orderedAt: "asc" } },
    });

    let daysToUse = shelfDays;
    if (allPurchases.length >= 2) {
      const first = allPurchases[0].order.orderedAt.getTime();
      const last  = allPurchases[allPurchases.length - 1].order.orderedAt.getTime();
      const actualAvg = (last - first) / (1000 * 60 * 60 * 24) / (allPurchases.length - 1);
      daysToUse = Math.round(actualAvg * 0.6 + shelfDays * 0.4);
    }

    const predictedRunoutAt = new Date(
      lastPurchase.order.orderedAt.getTime() + daysToUse * 86_400_000
    );

    await db.inventoryItem.update({
      where: { id: item.id },
      data: { runoutPredictedAt: predictedRunoutAt },
    });
    updated++;
  }

  return { itemsUpdated: updated, itemsSkipped: skipped };
}
