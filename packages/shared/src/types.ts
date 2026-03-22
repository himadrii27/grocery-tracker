import { z } from "zod";

// ─── Extension → API Types ───────────────────────────────────────────────────

export const ParsedLineItemSchema = z.object({
  platformName: z.string().max(500),
  quantity: z.number().int().positive().max(1000),
  unitSize: z.number().max(100_000).optional(),
  unitType: z.string().max(20).optional(), // "ml" | "g" | "pieces" | "kg"
  priceINR: z.number().int().nonnegative().max(1_000_000),
});

export const ParsedOrderSchema = z.object({
  platformOrderId: z.string().max(200),
  orderedAt: z.coerce.date(),
  platform: z.enum(["SWIGGY_INSTAMART", "BLINKIT", "ZEPTO"]),
  lineItems: z.array(ParsedLineItemSchema).min(1).max(200),
  totalAmountINR: z.number().int().nonnegative().max(1_000_000),
});

export type ParsedLineItem = z.infer<typeof ParsedLineItemSchema>;
export type ParsedOrder = z.infer<typeof ParsedOrderSchema>;

// ─── Sync API Request/Response ───────────────────────────────────────────────

export const SyncRequestSchema = z.object({
  // Max 200 orders per sync (covers ~6 months of weekly grocery orders)
  orders: z.array(ParsedOrderSchema).max(200),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export interface SyncResponse {
  sessionId: string;
  accepted: number;
  duplicates: number;
}

export interface SyncStatusResponse {
  sessionId: string;
  status: "processing" | "complete" | "failed";
  processedOrders: number;
  totalOrders: number;
  error?: string;
}

// ─── Inventory / Dashboard Types ─────────────────────────────────────────────

export type StockLevel = "critical" | "low" | "ok" | "unknown";

export interface InventoryItemWithDetails {
  id: string;
  groceryItemId: string;
  name: string;
  normalizedName: string;
  category: string;
  estimatedStockUnits: number;
  unitType: string;
  runoutPredictedAt: Date | null;
  daysUntilRunout: number | null;
  stockLevel: StockLevel;
  lastUpdatedAt: Date;
}

// ─── Reorder Types ───────────────────────────────────────────────────────────

export interface ReorderSuggestion {
  id: string;
  groceryItemId: string;
  itemName: string;
  platform: string;
  quantitySuggested: number;
  deepLink: string;
  reasoning: string;
  confidence: number;
  daysUntilRunout: number;
}
