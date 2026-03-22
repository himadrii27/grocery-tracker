/**
 * Blinkit Network Interceptor — runs in MAIN world (document_start)
 *
 * Because this runs in the page's own JS environment (not the isolated content
 * script sandbox), it can override window.fetch / XMLHttpRequest before the
 * React app runs. CSP does NOT block extension MAIN world scripts.
 *
 * Captured order payloads are posted to window so the ISOLATED world script
 * (content-blinkit.js) can pick them up and relay to chrome.runtime.
 *
 * No chrome.runtime or chrome.* APIs are available here.
 */

// Override fetch
const _originalFetch = window.fetch.bind(window);
(window as typeof window & { fetch: typeof fetch }).fetch = function (...args: Parameters<typeof fetch>) {
  const req = args[0];
  const url = typeof req === "string" ? req : req instanceof URL ? req.href : (req as Request).url ?? "";
  const p = _originalFetch(...args);
  if (/order/i.test(url)) {
    p.then((res) => {
      const clone = res.clone();
      clone.json().then((data: unknown) => {
        window.postMessage({ __gt: "BLINKIT_RESPONSE", url, data }, "*");
      }).catch(() => {});
    }).catch(() => {});
  }
  return p;
};

// Override XMLHttpRequest
// Use any[] to avoid TypeScript overload strictness on XMLHttpRequest.prototype.open
/* eslint-disable @typescript-eslint/no-explicit-any */
const _xhrOpen: (...args: any[]) => void = XMLHttpRequest.prototype.open as any;
const _xhrSend: (...args: any[]) => void = XMLHttpRequest.prototype.send as any;

(XMLHttpRequest.prototype as any).open = function (this: any, ...args: any[]) {
  this.__gt_url = String(args[1] ?? "");
  return _xhrOpen.apply(this, args);
};

(XMLHttpRequest.prototype as any).send = function (this: any, ...args: any[]) {
  const url: string = this.__gt_url ?? "";
  if (/order/i.test(url)) {
    this.addEventListener("load", function (this: XMLHttpRequest) {
      try {
        const data: unknown = JSON.parse(this.responseText);
        window.postMessage({ __gt: "BLINKIT_RESPONSE", url, data }, "*");
      } catch { /* non-JSON */ }
    });
  }
  return _xhrSend.apply(this, args);
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Also expose any window state at point-in-time via a snapshot message
// so the isolated script can read it (it can't access JS vars directly).
document.addEventListener("DOMContentLoaded", () => {
  const win = window as Window & {
    __STORE__?: unknown;
    __INITIAL_STATE__?: unknown;
    __REDUX_STORE__?: { getState?: () => unknown };
  };
  const state =
    (win.__REDUX_STORE__?.getState?.()) ??
    win.__STORE__ ??
    win.__INITIAL_STATE__;
  if (state) {
    window.postMessage({ __gt: "BLINKIT_STATE", data: state }, "*");
  }
});
