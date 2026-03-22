import { inngest } from "./inngest-client";
import { db } from "@grocery-tracker/db";
import { Resend } from "resend";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Weekly grocery digest email.
 * Runs every Sunday at 8am IST (02:30 UTC).
 * Sends a summary of spending + low/critical items to every user.
 */
export const weeklyDigestJob = inngest.createFunction(
  { id: "weekly-digest", name: "Weekly Grocery Digest Email" },
  { cron: "30 2 * * 0" }, // Sunday 8am IST = 02:30 UTC
  async ({ step, logger }) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      logger.warn("RESEND_API_KEY not set — skipping digest emails");
      return { skipped: true };
    }

    const resend = new Resend(resendKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "digest@grocery-tracker.app";

    const users = await step.run("fetch-users", async () => {
      return db.user.findMany({ select: { id: true, email: true } });
    });

    logger.info(`Sending weekly digest to ${users.length} users`);
    let sent = 0;

    for (const user of users) {
      await step.run(`send-digest-${user.id}`, async () => {
        const data = await buildDigestData(user.id);
        if (!data.hasActivity) return { skipped: true };

        const html = buildEmailHtml(data);
        await resend.emails.send({
          from: fromAddress,
          to: user.email,
          subject: buildSubject(data),
          html,
        });
        sent++;
      });
    }

    return { userCount: users.length, sent };
  }
);

// ─── Data collection ───────────────────────────────────────────────────────────

async function buildDigestData(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Spending this week
  const weekOrders = await db.order.findMany({
    where: { userId, orderedAt: { gte: weekAgo } },
    include: { lineItems: { include: { groceryItem: { select: { category: true } } } } },
  });

  const weeklySpend = weekOrders.reduce((s, o) => {
    const lineTotal = o.lineItems.reduce((ls, li) => ls + li.priceINR, 0);
    return s + (lineTotal > 0 ? lineTotal : (o.totalAmountINR ?? 0));
  }, 0);

  // Inventory status
  const inventory = await db.inventoryItem.findMany({
    where: { userId },
    include: { groceryItem: { select: { name: true, category: true } } },
  });

  const critical: string[] = [];
  const low: string[] = [];

  for (const item of inventory) {
    if (!item.runoutPredictedAt) continue;
    const daysLeft = Math.ceil((item.runoutPredictedAt.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft <= 0)      critical.push(item.groceryItem.name);
    else if (daysLeft <= 3) low.push(item.groceryItem.name);
  }

  // Top spending category this week
  const catSpend: Record<string, number> = {};
  for (const order of weekOrders) {
    const catSet = new Set(order.lineItems.map((li) => li.groceryItem.category));
    const lineTotal = order.lineItems.reduce((s, li) => s + li.priceINR, 0);
    const total = lineTotal > 0 ? lineTotal : (order.totalAmountINR ?? 0);
    if (total > 0 && catSet.size > 0) {
      const perCat = Math.round(total / catSet.size);
      catSet.forEach((cat) => { catSpend[cat] = (catSpend[cat] ?? 0) + perCat; });
    }
  }
  const topCategory = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  return {
    hasActivity: weekOrders.length > 0 || critical.length > 0 || low.length > 0,
    weeklySpend,
    orderCount: weekOrders.length,
    critical,
    low,
    topCategory,
    totalItems: inventory.length,
  };
}

function buildSubject(data: Awaited<ReturnType<typeof buildDigestData>>) {
  if (data.critical.length > 0) {
    return `🚨 ${data.critical.length} item${data.critical.length > 1 ? "s" : ""} out of stock — weekly grocery digest`;
  }
  if (data.low.length > 0) {
    return `⚠️ ${data.low.length} item${data.low.length > 1 ? "s" : ""} running low — weekly grocery digest`;
  }
  return `📊 Your weekly grocery digest — ₹${data.weeklySpend.toLocaleString("en-IN")} spent`;
}

function buildEmailHtml(data: Awaited<ReturnType<typeof buildDigestData>>) {
  const rows = {
    spent: data.weeklySpend > 0
      ? `<tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;font-size:14px">Spent this week</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;font-size:18px;text-align:right">₹${data.weeklySpend.toLocaleString("en-IN")}</td></tr>`
      : "",
    orders: data.orderCount > 0
      ? `<tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;font-size:14px">Orders placed</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;font-size:18px;text-align:right">${data.orderCount}</td></tr>`
      : "",
    topCat: data.topCategory
      ? `<tr><td style="padding:12px 0;color:#6b7280;font-size:14px">Top category</td><td style="padding:12px 0;font-weight:600;font-size:18px;text-align:right;text-transform:capitalize">${data.topCategory.toLowerCase().replace("_", " ")}</td></tr>`
      : "",
  };

  const criticalSection = data.critical.length > 0 ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#dc2626;font-size:14px">🚨 Out of stock — order now</p>
      ${data.critical.map((n) => `<p style="margin:4px 0;font-size:14px;color:#374151">• ${escapeHtml(n)}</p>`).join("")}
    </div>` : "";

  const lowSection = data.low.length > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#d97706;font-size:14px">⚠️ Running low — order within 3 days</p>
      ${data.low.map((n) => `<p style="margin:4px 0;font-size:14px;color:#374151">• ${escapeHtml(n)}</p>`).join("")}
    </div>` : "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://grocery-tracker.app";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0">

    <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827">Your weekly grocery digest</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">Here's how your household did this week.</p>

    ${(rows.spent || rows.orders || rows.topCat) ? `
    <table style="width:100%;border-collapse:collapse">
      ${rows.spent}${rows.orders}${rows.topCat}
    </table>` : ""}

    ${criticalSection}
    ${lowSection}

    ${(data.critical.length === 0 && data.low.length === 0) ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0">
      <p style="margin:0;font-size:14px;color:#166534">✅ All ${data.totalItems} tracked items are well stocked.</p>
    </div>` : ""}

    <a href="${appUrl}/reorders"
       style="display:block;background:#16a34a;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;margin-top:24px">
      View dashboard →
    </a>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center">
      Grocery Tracker · <a href="${appUrl}/settings" style="color:#9ca3af">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}
