import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const reordersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "LINK_GENERATED", "SKIPPED", "FAILED"]).optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.reorderLog.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.status ? { status: input.status } : {}),
        },
        include: { groceryItem: true },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  confirmDeepLink: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reorderLog.update({
        where: { id: input.id, userId: ctx.user.id },
        data: { status: "LINK_GENERATED" },
      });
    }),

  skip: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reorderLog.update({
        where: { id: input.id, userId: ctx.user.id },
        data: { status: "SKIPPED" },
      });
    }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.userPreference.findUnique({
      where: { userId: ctx.user.id },
    });
  }),
});
