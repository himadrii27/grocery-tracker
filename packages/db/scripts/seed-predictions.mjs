/**
 * Smart prediction seeder.
 *
 * Skips non-consumable items entirely (vase, mattress, lights, clothing…)
 * and uses category-appropriate shelf-life estimates for consumables.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required. Copy packages/db/.env.example and set it.");
}

const { PrismaClient } = await import("../generated/client/default.js");

const db = new PrismaClient();

// ─── Non-consumable keyword list ─────────────────────────────────────────────
// If the item name matches any of these, it never needs restocking.
const NON_CONSUMABLE_PATTERNS = [
  /vase/i, /lamp/i, /\blight\b/i, /bulb/i, /pixel light/i,
  /mattress/i, /foldable/i, /pillow/i, /blanket/i, /towel/i,
  /shorts/i, /underskirt/i, /claw clip/i, /hair clip/i, /scrunchie/i,
  /party glass/i, /\bglass(es)?\b/i, /tumbler/i, /mug/i,
  /decorative/i, /decor\b/i, /figurine/i, /showpiece/i,
  /cable/i, /charger/i, /stand\b/i, /rack/i, /basket\b/i,
  /frame\b/i, /mirror\b/i, /hangers?/i, /hooks?/i,
  /notebook/i, /diary/i, /stationery/i,
  /\bclip\b/i,    // hair clip, binder clip — not consumable
  /femmora/i,     // Rupa Femmora is clothing
];

// ─── Category → realistic shelf-life in days ─────────────────────────────────
// Based on typical Indian household consumption patterns.
const SHELF_LIFE = {
  PRODUCE:      4,   // bananas, tomatoes, leafy greens — eat within days
  DAIRY:        7,   // milk 3-5d, paneer ~1wk, curd ~1wk
  FROZEN:       30,  // frozen peas, ice cream etc.
  GRAINS:       45,  // oats, atta, rice — bought monthly
  BEVERAGES:    30,  // juices, packaged drinks
  SNACKS:       21,  // chips, biscuits
  CONDIMENTS:   60,  // oils, sauces, spices
  PERSONAL_CARE:75,  // shampoo, serum, face wash — 2-3 months
  CLEANING:     45,  // detergent, dish soap
  OTHER:        null, // unknown — skip prediction
};

function isNonConsumable(name) {
  return NON_CONSUMABLE_PATTERNS.some((re) => re.test(name));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const users = await db.user.findMany({ select: { id: true } });
console.log(`Found ${users.length} user(s)\n`);

for (const user of users) {
  const items = await db.inventoryItem.findMany({
    where: { userId: user.id },
    include: { groceryItem: true },
  });

  console.log(`User ${user.id}: ${items.length} items`);

  for (const item of items) {
    const name = item.groceryItem.name;
    const category = item.groceryItem.category;

    // 1. Skip non-consumables — clear any stale prediction
    if (isNonConsumable(name)) {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { runoutPredictedAt: null },
      });
      console.log(`  ⬜ skip  [${category}] ${name}  (non-consumable)`);
      continue;
    }

    // 2. Skip if no shelf-life estimate for this category
    const shelfDays = SHELF_LIFE[category] ?? null;
    if (shelfDays === null) {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { runoutPredictedAt: null },
      });
      console.log(`  ⬜ skip  [${category}] ${name}  (category not tracked)`);
      continue;
    }

    // 3. Get most recent purchase
    const lastPurchase = await db.orderLineItem.findFirst({
      where: {
        groceryItemId: item.groceryItemId,
        order: { userId: user.id },
      },
      include: { order: true },
      orderBy: { order: { orderedAt: "desc" } },
    });

    if (!lastPurchase) {
      console.log(`  ⬜ skip  [${category}] ${name}  (no purchase history)`);
      continue;
    }

    // 4. If multiple purchases, use actual avg interval instead of category default
    const allPurchases = await db.orderLineItem.findMany({
      where: {
        groceryItemId: item.groceryItemId,
        order: { userId: user.id },
      },
      include: { order: true },
      orderBy: { order: { orderedAt: "asc" } },
    });

    let daysToUse = shelfDays;
    if (allPurchases.length >= 2) {
      const first = allPurchases[0].order.orderedAt.getTime();
      const last = allPurchases[allPurchases.length - 1].order.orderedAt.getTime();
      const actualAvg = (last - first) / (1000 * 60 * 60 * 24) / (allPurchases.length - 1);
      // Blend: 60% actual, 40% category default (avoids outliers from a single gap)
      daysToUse = Math.round(actualAvg * 0.6 + shelfDays * 0.4);
    }

    const predictedRunoutAt = new Date(
      lastPurchase.order.orderedAt.getTime() + daysToUse * 86_400_000
    );

    await db.inventoryItem.update({
      where: { id: item.id },
      data: { runoutPredictedAt: predictedRunoutAt },
    });

    const daysLeft = Math.ceil((predictedRunoutAt.getTime() - Date.now()) / 86_400_000);
    const tag =
      daysLeft <= 0 ? "🚨 OUT   " :
      daysLeft <= 1 ? "🚨 CRIT  " :
      daysLeft <= 3 ? "⚠️  LOW   " : "✅ OK    ";

    console.log(`  ${tag} [${category}] ${name}: ${daysLeft}d left  (shelf ~${daysToUse}d)`);
  }
}

await db.$disconnect();
console.log("\nDone — refresh the dashboard!");
