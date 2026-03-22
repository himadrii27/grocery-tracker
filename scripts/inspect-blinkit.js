/**
 * Headed Playwright script to inspect Blinkit orders page
 * and figure out the actual data structure.
 */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to Blinkit orders...");
  await page.goto("https://blinkit.com/account/orders", { waitUntil: "networkidle", timeout: 30000 });

  await page.waitForTimeout(4000);

  console.log("\n=== Current URL ===");
  console.log(page.url());

  console.log("\n=== Window state keys ===");
  const stateKeys = await page.evaluate(() => {
    const keys = [];
    if (window.__STORE__) keys.push("__STORE__: " + JSON.stringify(Object.keys(window.__STORE__)));
    if (window.__INITIAL_STATE__) keys.push("__INITIAL_STATE__: " + JSON.stringify(Object.keys(window.__INITIAL_STATE__)));
    if (window.__NEXT_DATA__) keys.push("__NEXT_DATA__: " + JSON.stringify(Object.keys(window.__NEXT_DATA__)));
    // Check all window keys that might contain orders
    const orderKeys = Object.keys(window).filter(k =>
      k.toLowerCase().includes('order') || k.toLowerCase().includes('store') || k.toLowerCase().includes('redux')
    );
    if (orderKeys.length) keys.push("Order-related window keys: " + JSON.stringify(orderKeys));
    return keys.length ? keys : ["No state found"];
  });
  stateKeys.forEach(k => console.log(k));

  console.log("\n=== __NEXT_DATA__ structure ===");
  const nextData = await page.evaluate(() => {
    if (!window.__NEXT_DATA__) return "not found";
    const d = window.__NEXT_DATA__;
    // Recursively find keys containing 'order'
    function findOrderKeys(obj, path = "", depth = 0) {
      if (depth > 4 || !obj || typeof obj !== "object") return [];
      const results = [];
      for (const key of Object.keys(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (key.toLowerCase().includes("order")) {
          const val = obj[key];
          if (Array.isArray(val)) results.push(`${fullPath}: Array(${val.length}) - first: ${JSON.stringify(val[0]).slice(0, 200)}`);
          else results.push(`${fullPath}: ${JSON.stringify(val).slice(0, 200)}`);
        }
        results.push(...findOrderKeys(obj[key], fullPath, depth + 1));
      }
      return results;
    }
    return findOrderKeys(d);
  });
  if (Array.isArray(nextData)) nextData.forEach(k => console.log(k));
  else console.log(nextData);

  console.log("\n=== DOM: order-related elements ===");
  const domInfo = await page.evaluate(() => {
    const results = [];
    // Try various selectors
    const selectors = [
      "[class*='order']", "[class*='Order']",
      "[data-testid*='order']", "[id*='order']",
      "[class*='Order__']", "[class*='order-card']",
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results.push(`"${sel}": ${els.length} elements`);
        if (els[0]) results.push(`  First: class="${els[0].className}" text="${els[0].textContent?.slice(0, 100)}"`);
      }
    }
    // Look for any elements with price-like content
    const priceEls = document.querySelectorAll("[class*='price'], [class*='Price'], [class*='amount'], [class*='Amount']");
    if (priceEls.length) results.push(`Price elements: ${priceEls.length}, first: "${priceEls[0]?.textContent?.slice(0, 50)}"`);

    return results.length ? results : ["No order DOM elements found"];
  });
  domInfo.forEach(d => console.log(d));

  console.log("\n=== Script tags with JSON data ===");
  const scriptData = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script[type='application/json'], script[id='__NEXT_DATA__']"));
    return scripts.map(s => `id=${s.id} content_start=${s.textContent?.slice(0, 300)}`);
  });
  scriptData.forEach(s => console.log(s));

  console.log("\n=== Network: Checking for orders API response ===");
  // Wait a bit more and check again
  await page.waitForTimeout(3000);

  console.log("\n=== Deep scan of page for order data ===");
  const deepScan = await page.evaluate(() => {
    // Look for any JSON-like data in script tags
    const allScripts = Array.from(document.querySelectorAll("script:not([src])"));
    const results = [];
    for (const script of allScripts) {
      const text = script.textContent || "";
      if (text.includes("order_id") || text.includes("orderId") || text.includes("order_number")) {
        results.push("Found order data in script: " + text.slice(0, 500));
      }
    }
    // Check window for any React fiber data
    const root = document.getElementById("__next") || document.getElementById("root");
    if (root) {
      const fiberKey = Object.keys(root).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
      results.push("React root found, fiber key: " + fiberKey);
    }
    return results.length ? results : ["No order JSON in scripts"];
  });
  deepScan.forEach(d => console.log(d));

  console.log("\n=== Screenshot saved ===");
  await page.screenshot({ path: "/Users/himadrisinha/Desktop/grocery-tracker/scripts/blinkit-orders.png", fullPage: true });
  console.log("Screenshot: scripts/blinkit-orders.png");

  await page.waitForTimeout(3000);
  await browser.close();
})();
