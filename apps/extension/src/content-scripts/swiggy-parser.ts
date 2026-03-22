/**
 * Swiggy Instamart Order History Parser
 * Runs on: https://www.swiggy.com/instamart/order-history
 *
 * Three-layer parsing strategy:
 * 1. CSS selectors (defined in selectors.json)
 * 2. window.__REDUX_STATE__ / JSON-LD in <script> tags
 * 3. Fallback: signals popup to trigger manual user action
 */

export {}; // Make this file a module to avoid global scope conflicts

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

// ─── Layer 2: Redux State / Script Tag Extraction ─────────────────────────────

function extractFromReduxState(): ParsedOrder[] {
  try {
    // Try window.__REDUX_STATE__
    const win = window as Window & {
      __REDUX_STATE__?: {
        instamartOrder?: {
          ordersList?: SwiggyOrderFromRedux[];
        };
      };
    };

    if (win.__REDUX_STATE__?.instamartOrder?.ordersList) {
      return parseSwiggyOrdersList(win.__REDUX_STATE__.instamartOrder.ordersList);
    }

    // Try to find embedded JSON in <script> tags
    const scripts = Array.from(document.querySelectorAll("script[type='application/json']"));
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        if (data?.instamartOrder?.ordersList) {
          return parseSwiggyOrdersList(data.instamartOrder.ordersList);
        }
        // Also try NEXT_DATA
        if (data?.props?.pageProps?.orders) {
          return parseNextDataOrders(data.props.pageProps.orders);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    // Try __NEXT_DATA__
    const nextDataScript = document.getElementById("__NEXT_DATA__");
    if (nextDataScript?.textContent) {
      const nextData = JSON.parse(nextDataScript.textContent);
      if (nextData?.props?.pageProps?.orders) {
        return parseNextDataOrders(nextData.props.pageProps.orders);
      }
    }
  } catch (err) {
    console.warn("[Grocery Tracker] Redux state extraction failed:", err);
  }
  return [];
}

// ─── Layer 1: CSS Selector DOM Parsing ───────────────────────────────────────

function extractFromDOM(): ParsedOrder[] {
  const orders: ParsedOrder[] = [];

  // Order cards — Swiggy uses dynamic class names, so we use structural selectors
  const orderCards = document.querySelectorAll(
    "[data-testid='order-card'], .order-card, [class*='OrderCard'], [class*='order-card']"
  );

  for (const card of Array.from(orderCards)) {
    try {
      const order = parseOrderCard(card as HTMLElement);
      if (order) orders.push(order);
    } catch {
      // Skip malformed cards
    }
  }

  return orders;
}

function parseOrderCard(card: HTMLElement): ParsedOrder | null {
  // Order ID — look for data attribute or text pattern
  const orderIdEl = card.querySelector(
    "[data-order-id], [data-testid='order-id']"
  );
  let platformOrderId =
    orderIdEl?.getAttribute("data-order-id") ??
    orderIdEl?.textContent?.trim() ??
    "";

  if (!platformOrderId) {
    // Try to extract from text content matching "Order #XXXXX" pattern
    const allText = card.textContent ?? "";
    const match = allText.match(/(?:Order\s*#?|#)\s*([A-Z0-9-]{5,})/i);
    if (match?.[1]) platformOrderId = match[1];
  }

  if (!platformOrderId) return null;

  // Date
  const dateEl = card.querySelector(
    "[data-testid='order-date'], [class*='date'], [class*='Date']"
  );
  const dateText = dateEl?.textContent?.trim() ?? "";
  const orderedAt = parseDateText(dateText);
  if (!orderedAt) return null;

  // Total amount
  const totalEl = card.querySelector(
    "[data-testid='order-total'], [class*='total'], [class*='Total']"
  );
  const totalText = totalEl?.textContent?.trim() ?? "";
  const totalAmountINR = parseAmountINR(totalText);

  // Line items — look for item rows
  const itemRows = card.querySelectorAll(
    "[data-testid='order-item'], [class*='ItemRow'], [class*='item-row'], [class*='OrderItem']"
  );

  const lineItems: ParsedLineItem[] = [];
  for (const row of Array.from(itemRows)) {
    const item = parseItemRow(row as HTMLElement);
    if (item) lineItems.push(item);
  }

  if (lineItems.length === 0) return null;

  return {
    platformOrderId,
    orderedAt,
    platform: "SWIGGY_INSTAMART",
    lineItems,
    totalAmountINR,
  };
}

function parseItemRow(row: HTMLElement): ParsedLineItem | null {
  const nameEl = row.querySelector(
    "[data-testid='item-name'], [class*='name'], [class*='Name']"
  );
  const platformName = nameEl?.textContent?.trim() ?? row.textContent?.trim() ?? "";
  if (!platformName) return null;

  // Quantity — look for "x2", "2x", "Qty: 2" patterns
  const qtyEl = row.querySelector(
    "[data-testid='item-qty'], [class*='qty'], [class*='quantity'], [class*='Qty']"
  );
  const qtyText = qtyEl?.textContent?.trim() ?? "";
  const quantity = parseQuantity(qtyText) ?? 1;

  // Price
  const priceEl = row.querySelector(
    "[data-testid='item-price'], [class*='price'], [class*='Price']"
  );
  const priceText = priceEl?.textContent?.trim() ?? "";
  const priceINR = parseAmountINR(priceText);

  // Unit size from item name
  const { unitSize, unitType } = extractUnitFromName(platformName);

  return { platformName, quantity, unitSize, unitType, priceINR };
}

// ─── Redux Data Types ─────────────────────────────────────────────────────────

interface SwiggyOrderFromRedux {
  order_id?: string | number;
  ordered_time_ms?: number;
  order_total?: number;
  items?: Array<{
    name?: string;
    quantity?: number;
    unit_size?: number;
    unit?: string;
    price?: number;
    display_price?: number;
  }>;
}

function parseSwiggyOrdersList(orders: SwiggyOrderFromRedux[]): ParsedOrder[] {
  return orders
    .map((order): ParsedOrder | null => {
      const platformOrderId = String(order.order_id ?? "");
      if (!platformOrderId) return null;

      const orderedAt = order.ordered_time_ms
        ? new Date(order.ordered_time_ms)
        : null;
      if (!orderedAt) return null;

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
        .filter((item): item is ParsedLineItem => item !== null);

      if (lineItems.length === 0) return null;

      return {
        platformOrderId,
        orderedAt,
        platform: "SWIGGY_INSTAMART",
        lineItems,
        totalAmountINR: order.order_total ?? 0,
      };
    })
    .filter((o): o is ParsedOrder => o !== null);
}

function parseNextDataOrders(orders: unknown[]): ParsedOrder[] {
  // Handle NEXT_DATA format — structure varies; best-effort extraction
  return (orders as SwiggyOrderFromRedux[])
    .map((o) => parseSwiggyOrdersList([o])[0])
    .filter((o): o is ParsedOrder => o !== undefined);
}

// ─── Parsing Helpers ──────────────────────────────────────────────────────────

function parseDateText(text: string): Date | null {
  if (!text) return null;

  // Try direct parse first
  const direct = new Date(text);
  if (!isNaN(direct.getTime())) return direct;

  // Indian date formats: "12 Mar 2024", "12/03/2024", "Today", "Yesterday"
  const today = new Date();
  if (/today/i.test(text)) return today;
  if (/yesterday/i.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // "12 Mar 2024" or "12 March 2024"
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  const ddMmmYyyy = text.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i);
  if (ddMmmYyyy) {
    const [, day, month, year] = ddMmmYyyy;
    const monthNum = monthNames[month.toLowerCase()];
    if (monthNum !== undefined) {
      return new Date(Number(year), monthNum, Number(day));
    }
  }

  return null;
}

function parseAmountINR(text: string): number {
  // Remove ₹, Rs, INR, commas; parse as float
  const cleaned = text.replace(/[₹Rs.,\s]/gi, "").replace(/INR/gi, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

function parseQuantity(text: string): number | null {
  if (!text) return null;
  // Patterns: "x2", "2x", "Qty: 2", "2", "2 items"
  const match = text.match(/(?:x|qty:?\s*)?(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractUnitFromName(name: string): {
  unitSize?: number;
  unitType?: string;
} {
  // Match patterns like "500ml", "1L", "200g", "1kg", "6 pieces", "12 pcs"
  const mlMatch = name.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (mlMatch) return { unitSize: parseFloat(mlMatch[1]), unitType: "ml" };

  const lMatch = name.match(/(\d+(?:\.\d+)?)\s*l(?:itre|iter)?(?:\b|$)/i);
  if (lMatch) return { unitSize: parseFloat(lMatch[1]) * 1000, unitType: "ml" };

  const gMatch = name.match(/(\d+(?:\.\d+)?)\s*g(?:m|ram)?(?:\b|$)/i);
  if (gMatch) return { unitSize: parseFloat(gMatch[1]), unitType: "g" };

  const kgMatch = name.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) return { unitSize: parseFloat(kgMatch[1]) * 1000, unitType: "g" };

  const pcsMatch = name.match(/(\d+)\s*(?:pieces?|pcs?|pack)/i);
  if (pcsMatch) return { unitSize: parseFloat(pcsMatch[1]), unitType: "pieces" };

  return {};
}

// ─── Main: Parse + Send to Service Worker ────────────────────────────────────

function parseAllOrders(): ParsedOrder[] {
  // Try Layer 2 first (most reliable when available)
  const fromRedux = extractFromReduxState();
  if (fromRedux.length > 0) {
    console.log(`[Grocery Tracker] Extracted ${fromRedux.length} orders from Redux state`);
    return fromRedux;
  }

  // Fall back to DOM parsing
  const fromDOM = extractFromDOM();
  if (fromDOM.length > 0) {
    console.log(`[Grocery Tracker] Extracted ${fromDOM.length} orders from DOM`);
    return fromDOM;
  }

  console.warn("[Grocery Tracker] Could not extract orders — may need manual action");
  return [];
}

// Run on page load
(function main() {
  // Wait for dynamic content to load
  const observer = new MutationObserver(() => {
    const orders = parseAllOrders();
    if (orders.length > 0) {
      observer.disconnect();
      chrome.runtime.sendMessage({
        type: "SYNC_ORDERS",
        orders,
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately (for already-loaded pages)
  setTimeout(() => {
    const orders = parseAllOrders();
    if (orders.length > 0) {
      observer.disconnect();
      chrome.runtime.sendMessage({
        type: "SYNC_ORDERS",
        orders,
      });
    }
  }, 2000);
})();
