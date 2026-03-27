import { initTRPC, TRPCError } from "@trpc/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@grocery-tracker/db";
import superjson from "superjson";
import { ZodError } from "zod";
import { cache } from "react";

// cache() deduplicates this across all tRPC calls within a single request,
// so a dashboard load with 4 parallel calls only hits the DB once.
const getOrCreateUser = cache(async (clerkId: string) => {
  const t0 = Date.now();
  let user = await db.user.findUnique({ where: { clerkId } });
  console.log(`[trpc] db.findUser ${Date.now() - t0}ms`);

  if (!user) {
    const t1 = Date.now();
    const clerkUser = await currentUser();
    console.log(`[trpc] currentUser() ${Date.now() - t1}ms`);
    const email =
      clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown`;
    user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, email },
    });
  }

  return user;
});

export async function createTRPCContext() {
  const t0 = Date.now();
  const { userId: clerkId } = await auth();
  console.log(`[trpc] auth() ${Date.now() - t0}ms`);

  const user = clerkId ? await getOrCreateUser(clerkId) : null;
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
