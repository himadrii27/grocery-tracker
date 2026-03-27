"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISS_KEY = "sync_banner_dismissed_at";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Props {
  lastSyncedAt: Date | null;
}

export function SyncReminderBanner({ lastSyncedAt }: Props) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!lastSyncedAt) return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_TTL_MS) return;

    const msAgo = Date.now() - new Date(lastSyncedAt).getTime();
    const daysAgo = Math.floor(msAgo / 86_400_000);
    const hoursAgo = Math.floor(msAgo / 3_600_000);

    if (msAgo < DISMISS_TTL_MS) return; // synced within 24h — no banner

    setLabel(daysAgo >= 1 ? `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago` : `${hoursAgo}h ago`);
    setVisible(true);
  }, [lastSyncedAt]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
      <p className="flex-1 text-amber-800">
        Last synced <strong>{label}</strong> — your predictions may be outdated.{" "}
        <Link href="/extension-auth" className="font-medium underline hover:no-underline">
          Sync now →
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-amber-500 hover:text-amber-700 p-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
