import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const ordersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orders = await ctx.db.order.findMany({
        where: { userId: ctx.user.id },
        include: {
          lineItems: {
            include: { groceryItem: true },
          },
        },
        orderBy: { orderedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (orders.length > input.limit) {
        nextCursor = orders.pop()!.id;
      }

      return { orders, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.order.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          lineItems: { include: { groceryItem: true } },
        },
      });
    }),

  spendingByCategory: protectedProcedure
    .input(z.object({ months: z.number().min(1).max(12).default(6) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setMonth(since.getMonth() - input.months);

      // Fetch orders with their line items so we can fall back to totalAmountINR
      // when individual priceINR values are 0 (e.g. Blinkit's widget API omits prices)
      const orders = await ctx.db.order.findMany({
        where: { userId: ctx.user.id, orderedAt: { gte: since } },
        include: {
          lineItems: {
            include: { groceryItem: { select: { category: true } } },
          },
        },
        orderBy: { orderedAt: "asc" },
      });

      const byMonth: Record<string, Record<string, number>> = {};

      for (const order of orders) {
        if (order.lineItems.length === 0) continue;

        const month = order.orderedAt.toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
        });
        if (!byMonth[month]) byMonth[month] = {};

        const totalLineItemSpend = order.lineItems.reduce((s, li) => s + li.priceINR, 0);
        const hasPrices = totalLineItemSpend > 0;

        if (hasPrices) {
          // Use actual per-item prices (Swiggy orders)
          for (const li of order.lineItems) {
            const cat = li.groceryItem.category;
            byMonth[month][cat] = (byMonth[month][cat] ?? 0) + li.priceINR;
          }
        } else if (order.totalAmountINR && order.totalAmountINR > 0) {
          // No per-item prices (Blinkit) — distribute order total equally across categories
          const catSet = new Set(order.lineItems.map((li) => li.groceryItem.category));
          const perCat = Math.round(order.totalAmountINR / catSet.size);
          for (const cat of catSet) {
            byMonth[month][cat] = (byMonth[month][cat] ?? 0) + perCat;
          }
        }
      }

      const parseMonthKey = (s: string) => {
        const [mon, yr] = s.split(" ");
        return new Date(`${mon} 1, 20${yr}`).getTime();
      };

      return Object.entries(byMonth)
        .sort(([a], [b]) => parseMonthKey(a) - parseMonthKey(b))
        .map(([month, cats]) => ({ month, ...cats }));
    }),
});
