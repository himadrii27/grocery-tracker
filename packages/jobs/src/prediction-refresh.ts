import { inngest } from "./inngest-client";
import { db } from "@grocery-tracker/db";
import { predictConsumption } from "@grocery-tracker/ai";

/**
 * Daily prediction refresh job.
 * Runs at 6am IST (00:30 UTC) every day.
 * Refreshes consumption predictions for all users and fires runout events.
 */
export const predictionRefreshJob = inngest.createFunction(
  {
    id: "prediction_refresh",
    name: "Daily Prediction Refresh",
    concurrency: { limit: 5 }, // max 5 users in parallel
  },
  { cron: "30 0 * * *" }, // 6am IST = 00:30 UTC
  async ({ step, logger }) => {
    const users = await step.run("fetch-active-users", async () => {
      return db.user.findMany({
        include: { preferences: true },
      });
    });

    logger.info(`Refreshing predictions for ${users.length} users`);

    // Fan out — one step per user
    const results = await Promise.allSettled(
      users.map((user: typeof users[number]) =>
        step.run(`refresh-predictions-${user.id}`, async () => {
          return refreshUserPredictions(user.id, user.preferences?.notifyBeforeDays ?? 2);
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return { usersProcessed: users.length, succeeded, failed };
  }
);

async function refreshUserPredictions(userId: string, notifyBeforeDays: number) {
  // Get user's inventory items with grocery item details
  const inventoryItems = await db.inventoryItem.findMany({
    where: { userId },
    include: {
      groceryItem: true,
      user: { include: { preferences: true } },
    },
  });

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const runoutEvents: Array<{
    userId: string;
    groceryItemId: string;
    itemName: string;
    predictedRunoutAt: string;
    currentStockUnits: number;
    daysUntilRunout: number;
  }> = [];

  for (const item of inventoryItems) {
    try {
      // Get purchase history (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const purchaseHistory = await db.orderLineItem.findMany({
        where: {
          groceryItemId: item.groceryItemId,
          order: {
            userId,
            orderedAt: { gte: sixMonthsAgo },
          },
        },
        include: { order: true },
        orderBy: { order: { orderedAt: "desc" } },
        take: 20,
      });

      // Skip if no history
      if (purchaseHistory.length === 0) continue;

      // Check cache — skip if prediction is < 23h old
      const existingPrediction = await db.consumptionPrediction.findFirst({
        where: { userId, groceryItemId: item.groceryItemId },
        orderBy: { generatedAt: "desc" },
      });

      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
      if (existingPrediction && existingPrediction.generatedAt > twentyThreeHoursAgo) {
        continue; // Use cached prediction
      }

      // Generate new prediction
      const prediction = await predictConsumption({
        userId,
        groceryItemId: item.groceryItemId,
        itemName: item.groceryItem.name,
        normalizedName: item.groceryItem.normalizedName,
        unitType: item.groceryItem.unitType,
        defaultPackSize: item.groceryItem.defaultPackSize,
        currentEstimatedStock: item.estimatedStockUnits,
        householdSize: user.householdSize,
        purchaseHistory: purchaseHistory.map((li: typeof purchaseHistory[number]) => ({
          orderedAt: li.order.orderedAt,
          quantityOrdered: li.quantityOrdered,
          unitSize: li.unitSize ?? undefined,
          unitType: li.unitType ?? undefined,
        })),
      });

      const predictedRunoutAt = new Date(prediction.predictedRunoutAt);

      // Persist prediction
      await db.consumptionPrediction.create({
        data: {
          userId,
          groceryItemId: item.groceryItemId,
          avgDailyConsumption: prediction.avgDailyConsumptionUnits,
          predictedRunoutAt,
          confidenceScore: prediction.confidenceScore,
          reasoning: prediction.reasoning,
          contextFactors: prediction.contextFactors,
        },
      });

      // Update inventory item's runout prediction
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { runoutPredictedAt: predictedRunoutAt },
      });

      // Check if we should fire a runout event
      const daysUntilRunout = Math.ceil(
        (predictedRunoutAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (
        daysUntilRunout <= notifyBeforeDays &&
        prediction.recommendation !== "skip" &&
        prediction.confidenceScore >= 0.5
      ) {
        runoutEvents.push({
          userId,
          groceryItemId: item.groceryItemId,
          itemName: item.groceryItem.name,
          predictedRunoutAt: predictedRunoutAt.toISOString(),
          currentStockUnits: item.estimatedStockUnits,
          daysUntilRunout,
        });
      }
    } catch (err) {
      console.error(
        `Failed to refresh prediction for item ${item.groceryItemId}:`,
        err
      );
    }
  }

  // Fire runout events for items that need reordering
  if (runoutEvents.length > 0) {
    const { inngest } = await import("./inngest-client");
    await inngest.send(
      runoutEvents.map((event) => ({
        name: "grocery/runout.predicted" as const,
        data: event,
      }))
    );
  }

  return { itemsProcessed: inventoryItems.length, runoutEventsEmitted: runoutEvents.length };
}
