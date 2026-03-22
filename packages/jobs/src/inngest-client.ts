import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "grocery_tracker",
  name: "Grocery Tracker",
});

// ─── Event Types ──────────────────────────────────────────────────────────────

export type Events = {
  "grocery/runout.predicted": {
    data: {
      userId: string;
      groceryItemId: string;
      itemName: string;
      predictedRunoutAt: string; // ISO 8601
      currentStockUnits: number;
      daysUntilRunout: number;
    };
  };
  "grocery/reorder.triggered": {
    data: {
      userId: string;
      groceryItemId: string;
      source: "manual" | "auto";
    };
  };
  "grocery/orders.synced": {
    data: {
      userId: string;
      syncSessionId: string;
      orderCount: number;
    };
  };
};
