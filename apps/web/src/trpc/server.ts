import "server-only";
import { createCallerFactory, createTRPCContext } from "@/server/api/trpc";
import { appRouter } from "@/server/api/root";

const createCaller = createCallerFactory(appRouter);

export const api = createCaller(createTRPCContext);
