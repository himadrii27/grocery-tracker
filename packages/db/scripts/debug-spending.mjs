/**
 * Debug script: dumps orders and their totalAmountINR to diagnose chart issues.
 */

process.env.DATABASE_URL =
  "postgresql://postgres.oyusfdmsnodnkbeebcqe:xnXGSkmsnkS81g8t@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const { PrismaClient } = await import(
  "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/default.js"
);

const db = new PrismaClient();

const orders = await db.order.findMany({
  include: {
    lineItems: {
      include: { groceryItem: { select: { category: true, name: true } } },
    },
  },
  orderBy: { orderedAt: "desc" },
  take: 20,
});

console.log(`\nFound ${orders.length} orders (latest 20):\n`);

for (const order of orders) {
  const totalPriceINR = order.lineItems.reduce((s, li) => s + li.priceINR, 0);
  const cats = [...new Set(order.lineItems.map((li) => li.groceryItem.category))];
  const month = order.orderedAt.toLocaleString("en-US", { month: "short", year: "2-digit" });

  console.log(
    `  [${month}] platform=${order.platform} totalAmountINR=${order.totalAmountINR ?? "NULL"} lineItemTotal=${totalPriceINR} items=${order.lineItems.length} cats=${cats.join(",")}`
  );
}

const byMonth = {};
for (const order of orders) {
  if (order.lineItems.length === 0) continue;
  const month = order.orderedAt.toLocaleString("en-US", { month: "short", year: "2-digit" });
  if (!byMonth[month]) byMonth[month] = {};

  const totalLineItemSpend = order.lineItems.reduce((s, li) => s + li.priceINR, 0);
  const hasPrices = totalLineItemSpend > 0;

  if (hasPrices) {
    for (const li of order.lineItems) {
      const cat = li.groceryItem.category;
      byMonth[month][cat] = (byMonth[month][cat] ?? 0) + li.priceINR;
    }
  } else if (order.totalAmountINR && order.totalAmountINR > 0) {
    const catSet = new Set(order.lineItems.map((li) => li.groceryItem.category));
    const perCat = Math.round(order.totalAmountINR / catSet.size);
    for (const cat of catSet) {
      byMonth[month][cat] = (byMonth[month][cat] ?? 0) + perCat;
    }
  }
}

console.log("\nspendingByCategory result:");
const result = Object.entries(byMonth).map(([month, cats]) => ({ month, ...cats }));
console.log(JSON.stringify(result, null, 2));

await db.$disconnect();
