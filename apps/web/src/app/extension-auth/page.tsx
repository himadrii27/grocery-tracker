"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

// Separate component so useSearchParams is inside Suspense
function ExtensionAuthInner() {
  const { isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"pending" | "sent" | "error" | "no-ext">("pending");
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    if (!isSignedIn) return;

    const extId = searchParams.get("extId");
    if (!extId) {
      setStatus("no-ext");
      return;
    }

    async function sendToken(): Promise<void> {
      try {
        // Get a permanent extension token from our API (not a short-lived Clerk JWT)
        const res = await fetch("/api/extension/token", { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate extension token");
        const { token } = (await res.json()) as { token: string };
        if (!token) throw new Error("No token returned — make sure you are signed in");

        const extId = searchParams.get("extId")!;

        // chrome.runtime is injected by browsers when an externally_connectable
        // extension is installed. It won't exist in non-Chrome browsers.
        const chromeRuntime = (
          typeof window !== "undefined"
            ? (window as unknown as { chrome?: { runtime?: Chrome["runtime"] } }).chrome?.runtime
            : undefined
        );

        if (!chromeRuntime?.sendMessage) {
          throw new Error(
            "Chrome extension not detected — make sure it is installed and you reloaded it after installing"
          );
        }

        // Fire the auth message. In MV3 the service worker may go to sleep before
        // it can send a response callback, so we don't rely on the callback for
        // success — just sending without an immediate error is enough.
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          try {
            chromeRuntime.sendMessage!(
              extId,
              { type: "GROCERY_TRACKER_AUTH", token },
              (res: unknown) => {
                if (settled) return;
                settled = true;
                const response = res as { success?: boolean } | undefined;
                // If we got a response back, use it; otherwise treat as success
                // (MV3 service workers often sleep before the callback fires)
                if (chromeRuntime.lastError && !response) {
                  reject(new Error(chromeRuntime.lastError.message));
                } else {
                  resolve();
                }
              }
            );
            // Optimistically resolve after 1.5s if no callback came back
            // (service worker saved the token but went to sleep before responding)
            setTimeout(() => {
              if (!settled) {
                settled = true;
                resolve();
              }
            }, 1500);
          } catch (err) {
            reject(err);
          }
        });

        setStatus("sent");
      } catch (err) {
        setErrorDetail(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }

    void sendToken();
  }, [isSignedIn, searchParams]);

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Please sign in first.</p>
      </div>
    );
  }

  if (status === "no-ext") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-md w-full text-center">
          <div className="text-4xl mb-4">🧩</div>
          <h1 className="text-xl font-semibold mb-2">Open from Extension</h1>
          <p className="text-gray-500 text-sm mb-4">
            This page must be opened from the Grocery Tracker Chrome extension, not navigated to directly.
          </p>
          <ol className="text-left text-sm text-gray-600 space-y-2 mb-4">
            <li>1. Click the 🛒 Grocery Tracker icon in your Chrome toolbar</li>
            <li>2. Click <strong>"Connect Account"</strong> in the popup</li>
            <li>3. This page will open automatically with the correct link</li>
          </ol>
          <a href="/dashboard" className="text-sm text-green-600 hover:underline">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-md w-full text-center">
        <div className="text-4xl mb-4">
          {status === "sent" ? "✅" : status === "error" ? "❌" : "⏳"}
        </div>
        <h1 className="text-xl font-semibold mb-2">
          {status === "sent"
            ? "Extension Connected!"
            : status === "error"
              ? "Connection Failed"
              : "Connecting..."}
        </h1>
        <p className="text-gray-500 text-sm">
          {status === "sent"
            ? "You can close this tab and return to the extension."
            : status === "error"
              ? `Please try again or reinstall the extension.${errorDetail ? ` (${errorDetail})` : ""}`
              : "Sending auth token to extension..."}
        </p>
      </div>
    </div>
  );
}

// Chrome runtime types used by the web page (not @types/chrome, just what we need)
interface Chrome {
  runtime: {
    sendMessage: (
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void
    ) => void;
    lastError?: { message: string };
  };
}

export default function ExtensionAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-md w-full text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-xl font-semibold mb-2">Connecting...</h1>
          </div>
        </div>
      }
    >
      <ExtensionAuthInner />
    </Suspense>
  );
}
