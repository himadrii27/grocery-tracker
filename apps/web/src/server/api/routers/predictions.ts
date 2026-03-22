import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const predictionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        daysAhead: z.number().min(1).max(30).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() + input.daysAhead * 86_400_000);
      return ctx.db.consumptionPrediction.findMany({
        where: {
          userId: ctx.user.id,
          predictedRunoutAt: { lte: cutoff },
        },
        include: { groceryItem: true },
        orderBy: { predictedRunoutAt: "asc" },
      });
    }),

  getRunoutCalendar: protectedProcedure.query(async ({ ctx }) => {
    const next30Days = new Date(Date.now() + 30 * 86_400_000);
    const predictions = await ctx.db.consumptionPrediction.findMany({
      where: {
        userId: ctx.user.id,
        predictedRunoutAt: { lte: next30Days },
      },
      include: { groceryItem: true },
      orderBy: { predictedRunoutAt: "asc" },
    });

    // Group by date
    const calendar: Record<string, typeof predictions> = {};
    for (const p of predictions) {
      const date = p.predictedRunoutAt.toISOString().split("T")[0]!;
      if (!calendar[date]) calendar[date] = [];
      calendar[date].push(p);
    }
    return calendar;
  }),
});
