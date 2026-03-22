import { initTRPC, TRPCError } from "@trpc/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@grocery-tracker/db";
import superjson from "superjson";
import { ZodError } from "zod";

export async function createTRPCContext() {
  const { userId: clerkId } = await auth();

  let user = null;
  if (clerkId) {
    user = await db.user.findUnique({ where: { clerkId } });

    // Auto-create user row if missing (e.g. webhook not yet configured)
    if (!user) {
      const clerkUser = await currentUser();
      const email =
        clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown`;
      user = await db.user.upsert({
        where: { clerkId },
        update: {},
        create: { clerkId, email },
      });
    }
  }

  return { db, user };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});
