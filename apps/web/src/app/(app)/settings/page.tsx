"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data: prefs } = api.reorders.getSettings.useQuery();
  const [householdSize, setHouseholdSize] = useState(1);
  const [notifyBeforeDays, setNotifyBeforeDays] = useState(2);
  const [preferredPlatform, setPreferredPlatform] = useState<"SWIGGY_INSTAMART" | "BLINKIT" | "ZEPTO">("SWIGGY_INSTAMART");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prefs) {
      setHouseholdSize(prefs.householdSize);
      setNotifyBeforeDays(prefs.notifyBeforeDays);
      setPreferredPlatform(prefs.preferredPlatform as "SWIGGY_INSTAMART" | "BLINKIT" | "ZEPTO");
    }
  }, [prefs]);

  const saveMutation = api.reorders.saveSettings.useMutation({
    onSuccess: () => {
      void utils.reorders.getSettings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function handleSave() {
    saveMutation.mutate({ householdSize, notifyBeforeDays, preferredPlatform });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your preferences</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Household</h2>
          </CardHeader>
          <CardContent>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Household size
            </label>
            <select
              value={householdSize}
              onChange={(e) => setHouseholdSize(Number(e.target.value))}
              className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Notifications</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notify before runout (days)
                </label>
                <select
                  value={notifyBeforeDays}
                  onChange={(e) => setNotifyBeforeDays(Number(e.target.value))}
                  className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {[1, 2, 3, 5, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "day" : "days"} before
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Preferred Platform</h2>
          </CardHeader>
          <CardContent>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default reorder platform
            </label>
            <select
              value={preferredPlatform}
              onChange={(e) => setPreferredPlatform(e.target.value as "SWIGGY_INSTAMART" | "BLINKIT" | "ZEPTO")}
              className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="SWIGGY_INSTAMART">Swiggy Instamart</option>
              <option value="BLINKIT">Blinkit</option>
              <option value="ZEPTO">Zepto</option>
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Extension</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              Connect your browser extension to sync Swiggy Instamart orders.
            </p>
            <a
              href="/extension-auth"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Connect Extension
            </a>
          </CardContent>
        </Card>

        {saveMutation.isError && (
          <p className="text-sm text-red-600">Failed to save settings. Please try again.</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full max-w-xs"
        >
          {saveMutation.isPending ? "Saving…" : saved ? "Saved! ✓" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
