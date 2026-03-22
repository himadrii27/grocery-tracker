import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { StockLevel } from "@grocery-tracker/shared";

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
        lastUpdatedAt: item.lastUpdatedAt,
      };
    });
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
