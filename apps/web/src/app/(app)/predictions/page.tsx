import { api } from "@/trpc/server";

const categoryIcon: Record<string, string> = {
  DAIRY: "🥛", PRODUCE: "🥦", GRAINS: "🌾", BEVERAGES: "🧃",
  SNACKS: "🍿", PERSONAL_CARE: "🧴", CLEANING: "🧹",
  FROZEN: "🧊", CONDIMENTS: "🫙", OTHER: "🛒",
};

function formatDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return "Next week";
  if (diffDays < 21) return "In 2 weeks";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function PredictionsPage() {
  const calendar = await api.predictions.getRunoutCalendar();
  const entries = Object.entries(calendar).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Runout Calendar</h1>
        <p className="text-gray-500 mt-1">Items predicted to run out in the next 30 days</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-semibold text-gray-900">All stocked up for the next 30 days!</p>
          <p className="text-gray-500 text-sm mt-1">No runouts predicted. Keep it up!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {entries.map(([date, predictions]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {formatDateLabel(date)}
              </h2>
              <div className="space-y-2">
                {predictions.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{categoryIcon[p.groceryItem.category] ?? "🛒"}</span>
                      <div>
                        <p className="font-medium text-gray-900">{p.groceryItem.name}</p>
                        <p className="text-xs text-gray-400">
                          {Math.round(p.confidenceScore * 100)}% confidence
                        </p>
                      </div>
                    </div>
                    <a
                      href={`https://blinkit.com/s/?q=${encodeURIComponent(p.groceryItem.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-600 font-medium hover:text-brand-700 whitespace-nowrap"
                    >
                      Reorder →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
