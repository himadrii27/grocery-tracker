import { createTRPCRouter } from "./trpc";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { predictionsRouter } from "./routers/predictions";
import { reordersRouter } from "./routers/reorders";

export const appRouter = createTRPCRouter({
  inventory: inventoryRouter,
  orders: ordersRouter,
  predictions: predictionsRouter,
  reorders: reordersRouter,
});

export type AppRouter = typeof appRouter;
