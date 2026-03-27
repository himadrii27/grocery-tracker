/**
 * Chrome Extension Service Worker (Manifest V3)
 * Handles auth token relay and message routing.
 */

const APP_URL = "http://localhost:3000"; // Override via storage for prod

// ─── Message Types ────────────────────────────────────────────────────────────

interface SyncMessage {
  type: "SYNC_ORDERS";
  orders: unknown[];
}

interface AuthMessage {
  type: "AUTH_TOKEN";
  token: string;
}

interface StatusMessage {
  type: "GET_STATUS";
}

interface SyncErrorMessage {
  type: "SYNC_ERROR";
  success: false;
  error: string;
}

type ExtensionMessage = SyncMessage | AuthMessage | StatusMessage | SyncErrorMessage;

// ─── Storage Helpers ──────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const { authToken } = await chrome.storage.local.get("authToken");
  return authToken ?? null;
}

async function setAuthToken(token: string): Promise<void> {
  await chrome.storage.local.set({ authToken: token });
}

async function getSyncStatus(): Promise<{ lastSyncedAt: string | null; orderCount: number }> {
  const { lastSyncedAt, orderCount } = await chrome.storage.local.get([
    "lastSyncedAt",
    "orderCount",
  ]);
  return { lastSyncedAt: lastSyncedAt ?? null, orderCount: orderCount ?? 0 };
}

// ─── API Client ───────────────────────────────────────────────────────────────

async function syncOrdersToAPI(orders: unknown[]): Promise<{ sessionId: string }> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const appUrl = (await chrome.storage.local.get("appUrl")).appUrl ?? APP_URL;

  const response = await fetch(`${appUrl}/api/extension/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orders }),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<{ sessionId: string }>;
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "AUTH_TOKEN") {
      setAuthToken(message.token)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true; // Keep channel open
    }

    if (message.type === "SYNC_ORDERS") {
      syncOrdersToAPI(message.orders)
        .then(async (result) => {
          const count = message.orders.length;
          await chrome.storage.local.set({
            lastSyncedAt: new Date().toISOString(),
            orderCount: count,
            lastSessionId: result.sessionId,
          });
          sendResponse({ success: true, sessionId: result.sessionId });
          // Notify popup (may already be closed — ignore error)
          chrome.runtime
            .sendMessage({ type: "SYNC_COMPLETE", success: true, sessionId: result.sessionId })
            .catch(() => {});
          // Always show a Chrome notification so user knows sync finished
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Grocery Tracker — Sync Complete",
            message: `${count} order${count !== 1 ? "s" : ""} synced successfully. Open the app to see your inventory.`,
          });
        })
        .catch((err) => {
          sendResponse({ success: false, error: String(err) });
          chrome.runtime
            .sendMessage({ type: "SYNC_ERROR", success: false, error: String(err) })
            .catch(() => {});
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Grocery Tracker — Sync Failed",
            message: String(err),
          });
        });
      return true;
    }

    // Content script sends SYNC_ERROR when it can't parse orders — relay to popup
    if (message.type === "SYNC_ERROR") {
      chrome.runtime
        .sendMessage({ type: "SYNC_ERROR", success: false, error: message.error })
        .catch(() => {});
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Grocery Tracker — Sync Failed",
        message: message.error,
      });
      return false;
    }

    if (message.type === "GET_STATUS") {
      getSyncStatus()
        .then((status) => sendResponse(status))
        .catch(() => sendResponse({ lastSyncedAt: null, orderCount: 0 }));
      return true;
    }
  }
);

// ─── Listen for auth token from web app ──────────────────────────────────────

// The web app sends the token via postMessage → content script → service worker
chrome.runtime.onMessageExternal.addListener(
  (message: { type: string; token?: string; appUrl?: string }, _sender, sendResponse) => {
    if (message.type === "GROCERY_TRACKER_AUTH" && message.token) {
      const saves: Promise<void>[] = [setAuthToken(message.token)];
      if (message.appUrl) {
        saves.push(chrome.storage.local.set({ appUrl: message.appUrl }));
      }
      Promise.all(saves)
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
      return true;
    }
  }
);

export {};
