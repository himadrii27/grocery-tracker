import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@grocery-tracker/db";
import type { ItemCategory } from "@grocery-tracker/db";
import { SyncRequestSchema, normalizeItemName } from "@grocery-tracker/shared";
import { batchNormalizeItems } from "@grocery-tracker/ai";
import { inngest } from "@grocery-tracker/jobs";

// ─── Simple in-process rate limiter: max 5 syncs/minute per token ─────────────
const syncRateMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(token: string): boolean {
  const now = Date.now();
  // Purge expired entries to prevent unbounded memory growth
  if (syncRateMap.size > 500) {
    for (const [k, v] of syncRateMap) {
      if (now > v.resetAt) syncRateMap.delete(k);
    }
  }
  const entry = syncRateMap.get(token);
  if (!entry || now > entry.resetAt) {
    syncRateMap.set(token, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export async function POST(req: Request) {
  // Auth via permanent extension token (stored in DB — never expires)
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 syncs per minute per token
  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Look up user by their stored extension token
  const authedUser = await db.user.findUnique({ where: { extensionToken: token } });
  if (!authedUser) {
    return NextResponse.json(
      { error: "Invalid token — please reconnect the extension via Connect Account" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { orders } = parsed.data;

  // De-duplicate by platformOrderId
  const existingIds = new Set(
    (
      await db.order.findMany({
        where: {
          userId: authedUser.id,
          platformOrderId: { in: orders.map((o) => o.platformOrderId) },
        },
        select: { platformOrderId: true },
      })
    ).flatMap((o) => o.platformOrderId ? [o.platformOrderId] : [])
  );

  const newOrders = orders.filter((o) => !existingIds.has(o.platformOrderId));

  // Collect unique item names for normalization
  const rawNames = [
    ...new Set(newOrders.flatMap((o) => o.lineItems.map((li) => li.platformName))),
  ];

  // Layer 1: regex normalization
  const regexResults = rawNames.map((name) => ({
    name,
    result: normalizeItemName(name),
  }));

  const needsAI = regexResults
    .filter((r) => r.result?.confidence === "low")
    .map((r) => r.name);

  // Layer 2: Claude normalization for uncertain items
  let aiResults: Array<{
    originalName: string;
    normalizedName: string;
    category: string;
    unitType: string;
    defaultPackSize: number;
  }> = [];
  if (needsAI.length > 0) {
    aiResults = await batchNormalizeItems(needsAI).catch(() => []);
  }

  // Build name → normalized map
  const nameMap = new Map<
    string,
    { normalizedName: string; category: string; unitType: string; defaultPackSize: number }
  >();
  for (const { name, result } of regexResults) {
    if (result) nameMap.set(name, result);
  }
  for (const ai of aiResults) {
    nameMap.set(ai.originalName, ai);
  }

  const sessionId = crypto.randomUUID();
  let accepted = 0;

  for (const order of newOrders) {
    const lineItemsData: Array<{
      groceryItemId: string;
      quantityOrdered: number;
      unitSize?: number;
      unitType?: string;
      priceINR: number;
    }> = [];

    for (const li of order.lineItems) {
      const normalized = nameMap.get(li.platformName);
      if (!normalized) continue;

      const groceryItem = await db.groceryItem.upsert({
        where: { normalizedName: normalized.normalizedName },
        create: {
          name: li.platformName,
          normalizedName: normalized.normalizedName,
          category: normalized.category as ItemCategory,
          unitType: normalized.unitType,
          defaultPackSize: normalized.defaultPackSize,
        },
        update: {},
      });

      lineItemsData.push({
        groceryItemId: groceryItem.id,
        quantityOrdered: li.quantity,
        unitSize: li.unitSize,
        unitType: li.unitType,
        priceINR: li.priceINR,
      });
    }

    if (lineItemsData.length > 0) {
      await db.order.create({
        data: {
          userId: authedUser.id,
          platform: order.platform,
          platformOrderId: order.platformOrderId,
          orderedAt: order.orderedAt,
          totalAmountINR: order.totalAmountINR,
          rawPayload: order as object,
          lineItems: { create: lineItemsData },
        },
      });

      // Update inventory estimates
      for (const li of lineItemsData) {
        await db.inventoryItem.upsert({
          where: {
            userId_groceryItemId: {
              userId: authedUser.id,
              groceryItemId: li.groceryItemId,
            },
          },
          create: {
            userId: authedUser.id,
            groceryItemId: li.groceryItemId,
            estimatedStockUnits: li.quantityOrdered * (li.unitSize ?? 1),
          },
          update: {
            estimatedStockUnits: {
              increment: li.quantityOrdered * (li.unitSize ?? 1),
            },
          },
        });
      }

      accepted++;
    }
  }

  // Trigger background prediction refresh whenever new orders were synced
  if (accepted > 0) {
    await inngest.send({
      name: "grocery/orders.synced",
      data: { userId: authedUser.id, syncSessionId: sessionId, orderCount: accepted },
    }).catch(() => {
      // Non-fatal: predictions will be refreshed by the daily cron if this fails
    });
  }

  return NextResponse.json({
    sessionId,
    accepted,
    duplicates: orders.length - newOrders.length,
  });
}
