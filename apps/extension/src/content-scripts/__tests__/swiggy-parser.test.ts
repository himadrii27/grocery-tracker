/**
 * Swiggy parser fixture test.
 * Verifies the Redux-state extraction path against a known-good fixture.
 *
 * Run: node --loader ts-node/esm src/content-scripts/__tests__/swiggy-parser.test.ts
 * (Or add to your test runner once vitest/jest is configured.)
 */

import fixture from "../__fixtures__/swiggy-order-fixture.json";

// ─── Inline the extraction logic (mirrors swiggy-parser.ts Layer 2) ──────────

interface ParsedLineItem {
  platformName: string;
  quantity: number;
  unitSize?: number;
  unitType?: string;
  priceINR: number;
}

interface ParsedOrder {
  platformOrderId: string;
  orderedAt: Date;
  platform: "SWIGGY_INSTAMART";
  lineItems: ParsedLineItem[];
  totalAmountINR: number;
}

type SwiggyOrderRaw = typeof fixture.instamartOrder.ordersList[number];

function extractUnitFromName(name: string): { unitSize?: number; unitType?: string } {
  const ml = name.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (ml) return { unitSize: parseFloat(ml[1]), unitType: "ml" };
  const l = name.match(/(\d+(?:\.\d+)?)\s*l(?:itre|iter)?(?:\b|$)/i);
  if (l) return { unitSize: parseFloat(l[1]) * 1000, unitType: "ml" };
  const g = name.match(/(\d+(?:\.\d+)?)\s*g(?:m|ram)?(?:\b|$)/i);
  if (g) return { unitSize: parseFloat(g[1]), unitType: "g" };
  const kg = name.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return { unitSize: parseFloat(kg[1]) * 1000, unitType: "g" };
  return {};
}

function parseOrders(orders: SwiggyOrderRaw[]): ParsedOrder[] {
  return orders
    .map((order): ParsedOrder | null => {
      const platformOrderId = String(order.order_id ?? "");
      if (!platformOrderId) return null;
      const orderedAt = new Date(order.ordered_time_ms);
      if (isNaN(orderedAt.getTime())) return null;

      const lineItems: ParsedLineItem[] = (order.items ?? [])
        .map((item): ParsedLineItem | null => {
          const platformName = item.name?.trim() ?? "";
          if (!platformName) return null;
          const { unitSize, unitType } = extractUnitFromName(platformName);
          return {
            platformName,
            quantity: item.quantity ?? 1,
            unitSize: item.unit_size ?? unitSize,
            unitType: item.unit ?? unitType,
            priceINR: Math.round((item.price ?? item.display_price ?? 0) * 100) / 100,
          };
        })
        .filter((i): i is ParsedLineItem => i !== null);

      if (lineItems.length === 0) return null;
      return { platformOrderId, orderedAt, platform: "SWIGGY_INSTAMART", lineItems, totalAmountINR: order.order_total ?? 0 };
    })
    .filter((o): o is ParsedOrder => o !== null);
}

// ─── Assertions ───────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
}

const orders = parseOrders(fixture.instamartOrder.ordersList);

console.log("\nSwiggy Parser Fixture Test\n");

assert(orders.length === 2, "Extracts 2 orders from fixture");
assert(orders[0].platformOrderId === "SWG-2024-001", "First order ID matches");
assert(orders[0].platform === "SWIGGY_INSTAMART", "Platform is SWIGGY_INSTAMART");
assert(orders[0].lineItems.length === 4, "First order has 4 line items");
assert(orders[0].totalAmountINR === 486, "First order total is ₹486");

const milk = orders[0].lineItems.find((i) => i.platformName.includes("Amul Gold"));
assert(milk !== undefined, "Amul milk found in first order");
assert(milk!.quantity === 2, "Amul milk quantity is 2");
assert(milk!.unitSize === 500, "Amul milk unit size is 500");
assert(milk!.unitType === "ml", "Amul milk unit type is ml");
assert(milk!.priceINR === 32, "Amul milk price is ₹32");

const atta = orders[0].lineItems.find((i) => i.platformName.includes("Atta"));
assert(atta !== undefined, "Atta found in first order");
assert(atta!.unitSize === 5000, "Atta unit size is 5000g (5kg)");

assert(orders[1].lineItems.length === 3, "Second order has 3 line items");

console.log("\nAll tests passed.\n");
