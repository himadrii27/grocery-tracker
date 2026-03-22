"use client";

import dynamic from "next/dynamic";

const SpendingChart = dynamic(
  () => import("./SpendingChart").then((m) => m.SpendingChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
        Loading chart…
      </div>
    ),
  }
);

export function SpendingChartWrapper({ data }: { data: Array<Record<string, string | number>> }) {
  return <SpendingChart data={data} />;
}
