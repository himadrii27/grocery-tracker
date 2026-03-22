/**
 * Blinkit Order History Parser — ISOLATED world (document_idle)
 *
 * Blinkit's /v1/layout/order_history is a widget API. Each order is a
 * "snippet" containing a list of UI widgets, not a clean data object.
 *
 * Actual shape (confirmed from API response):
 *
 *  response.snippets[n].data.items = [
 *    { widget_type: "image_text_vr_type_header",
 *      data: {
 *        subtitle: { text: "Today, 4:48 pm" },           // ← date
 *        left_underlined_subtitle: { text: "₹144" },     // ← total
 *        title: { text: "Order delivered" }              // ← status label
 *      },
 *      tracking: {
 *        common_attributes: {
 *          order_id: "1884675299",
 *          order_status: "CANCELLED" | "DELIVERED" | ...
 *        }
 *      }
 *    },
 *    { widget_type: "snippet_separator_vr" },
 *    { widget_type: "horizontal_list",
 *      data: {
 *        horizontal_item_list: [
 *          { data: { image: { accessibility_text: { text: "Baby Banana" } } } },
 *          ...
 *        ]
 *      }
 *    },
 *    { widget_type: "bottom_button" / reorder widget }
 *  ]
 */

export {}; // Stripped from output by build script

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
  platform: "BLINKIT";
  lineItems: ParsedLineItem[];
  totalAmountINR: number;
}

// ─── Blinkit Layout API Parser ────────────────────────────────────────────────

interface BLWidget {
  widget_type?: string;
  data?: Record<string, unknown>;
  tracking?: {
    common_attributes?: {
      order_id?: string | number;
      order_status?: string;
    };
  };
}

interface BLSnippet {
  widget_type?: string;
  data?: { items?: BLWidget[] } & Record<string, unknown>;
}

interface BLLayoutResponse {
  is_success?: boolean;
  response?: { snippets?: BLSnippet[] };
}

function parseBlinkitLayoutResponse(raw: unknown): ParsedOrder[] {
  const resp = raw as BLLayoutResponse;
  if (!resp?.is_success || !Array.isArray(resp?.response?.snippets)) return [];

  const orders: ParsedOrder[] = [];

  for (const snippet of resp.response!.snippets!) {
    const items = snippet?.data?.items;
    if (!Array.isArray(items) || items.length === 0) continue;

    // Find the header widget — it holds order_id, date, total, status
    const header = items.find(
      (w) =>
        w.widget_type === "image_text_vr_type_header" &&
        w.tracking?.common_attributes?.order_id
    );
    if (!header) continue;

    const attrs = header.tracking!.common_attributes!;
    const platformOrderId = String(attrs.order_id);

    // Skip cancelled orders — they don't reflect real consumption
    if (attrs.order_status === "CANCELLED") continue;

    // Date: subtitle.text = "Today, 4:48 pm" | "Yesterday, 2:30 pm" | "25 Mar, 3:15 pm"
    const subtitleText =
      ((header.data?.subtitle as { text?: string } | undefined)?.text) ?? "";
    const orderedAt = parseDateText(subtitleText);
    if (!orderedAt) continue;

    // Total: left_underlined_subtitle.text = "₹144"
    const priceText =
      ((header.data?.left_underlined_subtitle as { text?: string } | undefined)?.text) ?? "";
    const totalAmountINR = parseAmountINR(priceText);

    // Products: horizontal_list → horizontal_item_list → image.accessibility_text.text
    const hListWidget = items.find((w) => w.widget_type === "horizontal_list");
    const hItems = (hListWidget?.data?.horizontal_item_list as unknown[]) ?? [];

    const lineItems: ParsedLineItem[] = hItems
      .map((hItem): ParsedLineItem | null => {
        const d = (hItem as { data?: { image?: { accessibility_text?: { text?: string } } } }).data;
        const name = d?.image?.accessibility_text?.text?.trim() ?? "";
        if (!name) return null;
        const { unitSize, unitType } = extractUnitFromName(name);
        return { platformName: name, quantity: 1, unitSize, unitType, priceINR: 0 };
      })
      .filter((i): i is ParsedLineItem => i !== null);

    if (lineItems.length === 0) continue;

    orders.push({ platformOrderId, orderedAt, platform: "BLINKIT", lineItems, totalAmountINR });
  }

  return orders;
}

// ─── __NEXT_DATA__ fallback (DOM-readable in ISOLATED world) ──────────────────

function extractFromNextData(): ParsedOrder[] {
  try {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el?.textContent) return [];
    const data = JSON.parse(el.textContent) as BLLayoutResponse;
    return parseBlinkitLayoutResponse(data);
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateText(text: string): Date | null {
  if (!text) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lower = text.toLowerCase();

  if (lower.startsWith("today")) return today;

  if (lower.startsWith("yesterday")) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return y;
  }

  // "25 Mar, 3:15 pm" or "25 Mar 2024, 3:15 pm"
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const m = text.match(/(\d{1,2})\s+([a-z]+)\s*(?:(\d{4})\s*)?[,\s]/i);
  if (m) {
    const mo = monthNames[m[2].toLowerCase().slice(0, 3)];
    if (mo !== undefined) {
      const year = m[3] ? Number(m[3]) : today.getFullYear();
      return new Date(year, mo, Number(m[1]));
    }
  }

  // ISO / standard date string fallback
  const d = new Date(text);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function parseAmountINR(text: string): number {
  const n = parseFloat(text.replace(/[₹Rs.,\s]/gi, "").replace(/INR/gi, ""));
  return isNaN(n) ? 0 : Math.round(n);
}

function extractUnitFromName(name: string): { unitSize?: number; unitType?: string } {
  const ml = name.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (ml) return { unitSize: parseFloat(ml[1]), unitType: "ml" };

  const l = name.match(/(\d+(?:\.\d+)?)\s*l(?:itre|iter)?(?:\b|$)/i);
  if (l) return { unitSize: parseFloat(l[1]) * 1000, unitType: "ml" };

  const g = name.match(/(\d+(?:\.\d+)?)\s*g(?:m|ram)?(?:\b|$)/i);
  if (g) return { unitSize: parseFloat(g[1]), unitType: "g" };

  const kg = name.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return { unitSize: parseFloat(kg[1]) * 1000, unitType: "g" };

  const pcs = name.match(/(\d+)\s*(?:pieces?|pcs?|pack)/i);
  if (pcs) return { unitSize: parseFloat(pcs[1]), unitType: "pieces" };

  return {};
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(function main() {
  let sent = false;

  function send(orders: ParsedOrder[], source: string) {
    if (sent || orders.length === 0) return;
    sent = true;
    observer.disconnect();
    console.log(`[Grocery Tracker] Sending ${orders.length} Blinkit orders (${source})`);
    chrome.runtime.sendMessage({ type: "SYNC_ORDERS", orders });
  }

  // Listen for data from MAIN world interceptor
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data as { __gt?: string; url?: string; data?: unknown };
    if (!msg?.__gt) return;

    if (msg.__gt === "BLINKIT_RESPONSE") {
      console.log("[Grocery Tracker] Intercepted:", msg.url);
      const orders = parseBlinkitLayoutResponse(msg.data);
      if (orders.length) {
        send(orders, `network:${msg.url}`);
      } else {
        console.warn(
          "[Grocery Tracker] No orders parsed from",
          msg.url,
          "| Top keys:",
          Object.keys((msg.data as object) ?? {}),
          "| Sample:",
          JSON.stringify(msg.data).slice(0, 800)
        );
      }
    }
  });

  function trySend() {
    if (sent) return;
    const fromNext = extractFromNextData();
    if (fromNext.length) send(fromNext, "__NEXT_DATA__");
  }

  const observer = new MutationObserver(() => { if (!sent) trySend(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(trySend, 3000);
  setTimeout(trySend, 7000);

  setTimeout(() => {
    if (!sent) {
      observer.disconnect();
      console.warn("[Grocery Tracker] Could not extract Blinkit orders after 12s");
      chrome.runtime.sendMessage({
        type: "SYNC_ERROR",
        success: false,
        error: "Could not read Blinkit orders. Make sure you are logged in to Blinkit.",
      });
    }
  }, 12000);
})();
