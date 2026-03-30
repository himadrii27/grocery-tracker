import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { StockLevel } from "@grocery-tracker/shared";

// Category → shelf-life in days
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
  NON_CONSUMABLE: null,
};

const NON_CONSUMABLE_PATTERNS = [
  /vase/i, /lamp/i, /\blight\b/i, /bulb/i, /pixel light/i,
  /mattress/i, /foldable/i, /pillow/i, /blanket/i, /towel/i,
  /shorts/i, /underskirt/i, /claw clip/i, /hair clip/i, /scrunchie/i,
  /party glass/i, /\bglass(es)?\b/i, /tumbler/i, /\bmug\b/i,
  /decorative/i, /\bdecor\b/i, /figurine/i, /showpiece/i,
  /cable/i, /charger/i, /\bstand\b/i, /\brack\b/i, /\bbasket\b/i,
  /\bframe\b/i, /\bmirror\b/i, /hangers?/i, /hooks?/i,
  /notebook/i, /diary/i, /stationery/i, /\bclip\b/i, /femmora/i,
];

function isNonConsumable(name: string, category: string): boolean {
  return (
    category === "NON_CONSUMABLE" ||
    SHELF_LIFE[category] === null ||
    NON_CONSUMABLE_PATTERNS.some((re) => re.test(name))
  );
}

async function applyHeuristicPredictions(
  userId: string,
  db: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]["ctx"]["db"]
) {
  const items = await db.inventoryItem.findMany({
    where: { userId },
    include: { groceryItem: true },
  });

  for (const item of items) {
    const name = item.groceryItem.name;
    const category = item.groceryItem.category as string;

    if (NON_CONSUMABLE_PATTERNS.some((re) => re.test(name))) {
      await db.inventoryItem.update({ where: { id: item.id }, data: { runoutPredictedAt: null } });
      continue;
    }

    const shelfDays = SHELF_LIFE[category] ?? null;
    if (shelfDays === null) {
      await db.inventoryItem.update({ where: { id: item.id }, data: { runoutPredictedAt: null } });
      continue;
    }

    const allPurchases = await db.orderLineItem.findMany({
      where: { groceryItemId: item.groceryItemId, order: { userId } },
      include: { order: true },
      orderBy: { order: { orderedAt: "asc" } },
    });

    if (allPurchases.length === 0) continue;

    let daysToUse = shelfDays;
    if (allPurchases.length >= 2) {
      const first = allPurchases[0]!.order.orderedAt.getTime();
      const last  = allPurchases[allPurchases.length - 1]!.order.orderedAt.getTime();
      const actualAvg = (last - first) / (1000 * 60 * 60 * 24) / (allPurchases.length - 1);
      daysToUse = Math.round(actualAvg * 0.6 + shelfDays * 0.4);
    }

    const lastPurchase = allPurchases[allPurchases.length - 1]!;
    const predictedRunoutAt = new Date(
      lastPurchase.order.orderedAt.getTime() + daysToUse * 86_400_000
    );

    await db.inventoryItem.update({ where: { id: item.id }, data: { runoutPredictedAt: predictedRunoutAt } });
  }
}

export const inventoryRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.inventoryItem.findMany({
      where: { userId: ctx.user.id },
      include: { groceryItem: true },
      orderBy: { runoutPredictedAt: "asc" },
    });

    return items.map((item: typeof items[number]) => {
      const daysUntilRunout = item.runoutPredictedAt
        ? Math.ceil((item.runoutPredictedAt.getTime() - Date.now()) / 86_400_000)
        : null;

      const stockLevel: StockLevel =
        daysUntilRunout === null
          ? "unknown"
          : daysUntilRunout <= 1
            ? "critical"
            : daysUntilRunout <= 3
              ? "low"
              : "ok";

      return {
        id: item.id,
        groceryItemId: item.groceryItemId,
        name: item.groceryItem.name,
        normalizedName: item.groceryItem.normalizedName,
        category: item.groceryItem.category,
        estimatedStockUnits: item.estimatedStockUnits,
        unitType: item.groceryItem.unitType,
        runoutPredictedAt: item.runoutPredictedAt,
        daysUntilRunout,
        stockLevel,
        isNonConsumable: isNonConsumable(item.groceryItem.name, item.groceryItem.category),
        lastUpdatedAt: item.lastUpdatedAt,
      };
    });
  }),

  rebuild: protectedProcedure.mutation(async ({ ctx }) => {
    const lineItems = await ctx.db.orderLineItem.findMany({
      where: { order: { userId: ctx.user.id } },
      include: { groceryItem: true },
    });

    const stockMap = new Map<string, { groceryItemId: string; category: string; total: number }>();
    for (const li of lineItems) {
      const key = li.groceryItemId;
      const existing = stockMap.get(key);
      const units = li.quantityOrdered * (li.unitSize ?? 1);
      if (existing) {
        existing.total += units;
      } else {
        stockMap.set(key, { groceryItemId: key, category: li.groceryItem.category, total: units });
      }
    }

    let rebuilt = 0;
    for (const { groceryItemId, category, total } of stockMap.values()) {
      if (category === "NON_CONSUMABLE") continue;
      await ctx.db.inventoryItem.upsert({
        where: { userId_groceryItemId: { userId: ctx.user.id, groceryItemId } },
        create: { userId: ctx.user.id, groceryItemId, estimatedStockUnits: total },
        update: { estimatedStockUnits: total },
      });
      rebuilt++;
    }

    await applyHeuristicPredictions(ctx.user.id, ctx.db);
    return { rebuilt };
  }),

  predict: protectedProcedure.mutation(async ({ ctx }) => {
    await applyHeuristicPredictions(ctx.user.id, ctx.db);
  }),

  updateManual: protectedProcedure
    .input(
      z.object({
        groceryItemId: z.string(),
        estimatedStockUnits: z.number().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.inventoryItem.update({
        where: {
          userId_groceryItemId: {
            userId: ctx.user.id,
            groceryItemId: input.groceryItemId,
          },
        },
        data: { estimatedStockUnits: input.estimatedStockUnits },
      });
    }),
});
