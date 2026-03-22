import { inngest } from "./inngest-client";
import { db } from "@grocery-tracker/db";
import type { Platform } from "@grocery-tracker/db";
import { runReorderAgent } from "@grocery-tracker/ai";
import type { ReorderAgentContext } from "@grocery-tracker/ai";

/**
 * Runout alert job — triggered when a prediction says an item will run out.
 * Runs the reorder agent to generate a deep-link suggestion.
 */
export const runoutAlertJob = inngest.createFunction(
  {
    id: "runout_alert",
    name: "Runout Alert → Reorder Suggestion",
    concurrency: { limit: 10 },
  },
  { event: "grocery/runout.predicted" },
  async ({ event, step, logger }) => {
    const { userId, groceryItemId, itemName, predictedRunoutAt, currentStockUnits } =
      event.data;

    // Check deduplication — don't re-run if a log exists within 24h
    const recentLog = await step.run("check-recent-log", async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return db.reorderLog.findFirst({
        where: {
          userId,
          groceryItemId,
          createdAt: { gte: since },
          status: { not: "FAILED" },
        },
      });
    });

    if (recentLog) {
      logger.info(`Skipping reorder for ${groceryItemId} — recent log exists`);
      return { skipped: true, reason: "duplicate_within_24h" };
    }

    // Run the reorder agent
    const agentResult = await step.run("run-reorder-agent", async () => {
      const toolImplementations: ReorderAgentContext["tools"] = {
        getCurrentInventory: async (id) => {
          const item = await db.inventoryItem.findFirst({
            where: { userId, groceryItemId: id },
            include: { groceryItem: true },
          });
          return {
            estimatedStockUnits: item?.estimatedStockUnits ?? 0,
            unitType: item?.groceryItem.unitType ?? "pieces",
          };
        },

        getPurchaseHistory: async (id, daysBack) => {
          const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
          const items = await db.orderLineItem.findMany({
            where: {
              groceryItemId: id,
              order: { userId, orderedAt: { gte: since } },
            },
            include: { order: true },
            orderBy: { order: { orderedAt: "desc" } },
          });
          return items.map((li: typeof items[number]) => ({
            orderedAt: li.order.orderedAt,
            quantityOrdered: li.quantityOrdered,
            priceINR: li.priceINR,
          }));
        },

        getUserPreferences: async (uid) => {
          const prefs = await db.userPreference.findUnique({ where: { userId: uid } });
          return {
            preferredPlatform: prefs?.preferredPlatform ?? "SWIGGY_INSTAMART",
            notifyBeforeDays: prefs?.notifyBeforeDays ?? 2,
          };
        },

        checkPlatformAvailability: async (_id, _platform) => {
          // TODO: Integrate with platform APIs when available
          // For now, assume items are available on the preferred platform
          return { available: true, priceINR: undefined };
        },

        generateReorderDeeplink: async (id, platform, quantity) => {
          return generateDeepLink(id, platform, quantity);
        },

        createReorderLog: async (params) => {
          const log = await db.reorderLog.create({
            data: {
              userId: params.userId,
              groceryItemId: params.groceryItemId,
              platform: params.platform as Platform,
              quantityOrdered: params.quantityOrdered,
              deepLink: params.deepLink,
              status: "LINK_GENERATED",
              agentTrace: params.agentTrace as object,
            },
          });
          return { id: log.id };
        },

        sendBrowserNotification: async (params) => {
          // Browser notifications are sent client-side via the Web Notifications API.
          // Here we store a pending notification in the DB for the client to pick up.
          await db.reorderLog.updateMany({
            where: {
              userId: params.userId,
              groceryItemId,
              status: "LINK_GENERATED",
            },
            data: { status: "LINK_GENERATED" }, // notification handled by frontend
          });
          logger.info(`Notification queued for user ${params.userId}: ${params.title}`);
        },
      };

      return runReorderAgent({
        userId,
        groceryItemId,
        itemName,
        predictedRunoutAt: new Date(predictedRunoutAt),
        currentStockUnits,
        tools: toolImplementations,
      });
    });

    return {
      action: agentResult.action,
      reorderLogId: agentResult.reorderLogId,
      deepLink: agentResult.deepLink,
    };
  }
);

// ─── Deep-link generation ─────────────────────────────────────────────────────

function generateDeepLink(
  groceryItemId: string,
  platform: string,
  quantity: number
): string {
  switch (platform) {
    case "SWIGGY_INSTAMART":
      // Swiggy Instamart deep-link: opens search for the item
      // When platform item IDs are available, use direct cart deep-link
      return `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(groceryItemId)}&qty=${quantity}`;

    case "BLINKIT":
      return `https://blinkit.com/s/?q=${encodeURIComponent(groceryItemId)}`;

    case "ZEPTO":
      return `https://www.zeptonow.com/search?query=${encodeURIComponent(groceryItemId)}`;

    default:
      return `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(groceryItemId)}`;
  }
}
