/**
 * Extension popup script
 * Handles sync trigger + auth connect flow
 */

const APP_URL = "http://localhost:3006";

const statusEl = document.getElementById("status")!;
const lastSyncedEl = document.getElementById("last-synced")!;
const syncSwiggyBtn = document.getElementById("sync-swiggy-btn") as HTMLButtonElement;
const syncBlinkitBtn = document.getElementById("sync-blinkit-btn") as HTMLButtonElement;
const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement;
const errorEl = document.getElementById("error")!;
const stepEl = document.getElementById("step")!;

function setStatus(status: string, type: "connected" | "disconnected" | "syncing" | "default" = "default") {
  statusEl.textContent = status;
  statusEl.className = `status-value ${type}`;
}

function setError(msg: string) { errorEl.textContent = msg; }
function setStep(msg: string) { stepEl.textContent = msg; }

function setSyncButtonsDisabled(disabled: boolean) {
  syncSwiggyBtn.disabled = disabled;
  syncBlinkitBtn.disabled = disabled;
}

async function init() {
  const { authToken, lastSyncedAt, orderCount } = await chrome.storage.local.get([
    "authToken", "lastSyncedAt", "orderCount",
  ]);

  if (!authToken) {
    setStatus("Not connected", "disconnected");
    setSyncButtonsDisabled(true);
    return;
  }

  setStatus("Connected", "connected");

  if (lastSyncedAt) {
    const d = new Date(lastSyncedAt as string);
    lastSyncedEl.textContent = `Last sync: ${d.toLocaleDateString("en-IN")} · ${orderCount ?? 0} orders`;
  }
}

async function triggerSync(platform: "swiggy" | "blinkit") {
  setSyncButtonsDisabled(true);
  setStatus("Syncing...", "syncing");
  setError("");

  const url = platform === "swiggy"
    ? "https://www.swiggy.com/instamart/order-history"
    : "https://blinkit.com/account/orders";
  const name = platform === "swiggy" ? "Swiggy" : "Blinkit";

  setStep(`Opening ${name} order history...`);

  try {
    // Open as inactive so popup stays open and can receive SYNC_COMPLETE
    const tab = await chrome.tabs.create({ url, active: false });
    setStep(`${name} tab opened in background — parsing orders...`);

    const listener = (message: { type: string; success?: boolean; error?: string }) => {
      if (message.type === "SYNC_COMPLETE" || message.type === "SYNC_ERROR") {
        chrome.runtime.onMessage.removeListener(listener);
        void chrome.tabs.remove(tab.id!);

        if (message.success) {
          setStatus("Synced!", "connected");
          setStep(`${name} orders synced. Visit the app to see your inventory.`);
          void init();
        } else {
          setStatus("Sync failed", "disconnected");
          setError(message.error ?? "Unknown error");
          setSyncButtonsDisabled(false);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    const timeoutMs = platform === "blinkit" ? 60_000 : 30_000;
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      if (tab.id) void chrome.tabs.remove(tab.id);
      setStatus("Timeout", "disconnected");
      setError(`Sync timed out. Try visiting ${name} order history manually.`);
      setSyncButtonsDisabled(false);
    }, timeoutMs);
  } catch (err) {
    setStatus("Error", "disconnected");
    setError(String(err));
    setSyncButtonsDisabled(false);
  }
}

syncSwiggyBtn.addEventListener("click", () => void triggerSync("swiggy"));
syncBlinkitBtn.addEventListener("click", () => void triggerSync("blinkit"));

connectBtn.addEventListener("click", () => {
  const extId = chrome.runtime.id;
  void chrome.tabs.create({ url: `${APP_URL}/extension-auth?extId=${extId}` });
});

void init();
