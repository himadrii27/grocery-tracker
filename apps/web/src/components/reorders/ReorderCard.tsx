"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReorderActionButtons } from "./ReorderActionButtons";

interface ReorderCardProps {
  id: string;
  itemName: string;
  platform: string;
  quantityOrdered: number;
  deepLink: string;
  reasoning: string;
  daysUntilRunout?: number;
  status: string;
  onConfirm: (id: string) => void;
  onSkip: (id: string) => void;
  isLoading?: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  SWIGGY_INSTAMART: "Swiggy Instamart",
  BLINKIT: "Blinkit",
  ZEPTO: "Zepto",
};

export function ReorderCard({
  id,
  itemName,
  platform,
  quantityOrdered,
  deepLink,
  reasoning,
  daysUntilRunout,
  status,
  onConfirm,
  onSkip,
  isLoading,
}: ReorderCardProps) {
  const urgencyVariant =
    daysUntilRunout !== undefined && daysUntilRunout <= 1 ? "critical" : "low";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">{itemName}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {PLATFORM_LABELS[platform] ?? platform} · Qty {quantityOrdered}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {daysUntilRunout !== undefined && (
              <Badge variant={urgencyVariant}>
                {daysUntilRunout <= 0 ? "Out now" : `${daysUntilRunout}d left`}
              </Badge>
            )}
            {status === "SKIPPED" && (
              <Badge variant="unknown">Skipped</Badge>
            )}
          </div>
        </div>

        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
            AI reasoning
          </p>
          <p className="text-sm text-gray-700">{reasoning}</p>
        </div>

        {status !== "SKIPPED" && (
          <ReorderActionButtons
            deepLink={deepLink}
            reorderLogId={id}
            onConfirm={onConfirm}
            onSkip={onSkip}
            isLoading={isLoading}
          />
        )}
      </CardContent>
    </Card>
  );
}
