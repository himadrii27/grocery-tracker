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
    const [prefs, user] = await Promise.all([
      ctx.db.userPreference.findUnique({ where: { userId: ctx.user.id } }),
      ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { householdSize: true },
      }),
    ]);
    return {
      householdSize: user?.householdSize ?? 1,
      notifyBeforeDays: prefs?.notifyBeforeDays ?? 2,
      preferredPlatform: prefs?.preferredPlatform ?? "SWIGGY_INSTAMART",
    };
  }),

  saveSettings: protectedProcedure
    .input(
      z.object({
        householdSize: z.number().min(1).max(8),
        notifyBeforeDays: z.number().min(1).max(7),
        preferredPlatform: z.enum(["SWIGGY_INSTAMART", "BLINKIT", "ZEPTO"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        ctx.db.user.update({
          where: { id: ctx.user.id },
          data: { householdSize: input.householdSize },
        }),
        ctx.db.userPreference.upsert({
          where: { userId: ctx.user.id },
          update: {
            notifyBeforeDays: input.notifyBeforeDays,
            preferredPlatform: input.preferredPlatform,
          },
          create: {
            userId: ctx.user.id,
            notifyBeforeDays: input.notifyBeforeDays,
            preferredPlatform: input.preferredPlatform,
          },
        }),
      ]);
    }),
});
