import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EVAL_TARGETS = {
  maeTarget: 1.5,
  withinThreeDaysPctTarget: 85,
};

const EVAL_FIXTURES = [
  {
    id: 1,
    description: "Single professional — Amul milk 500ml, daily consumption",
    householdSize: 1,
    purchaseCount: 5,
    currentStock: "1500ml (3 packets)",
    expectedRunout: "3 days",
    expectedPattern: "regular",
  },
  {
    id: 2,
    description: "Family of 4 — Basmati rice 5kg, weekly purchase",
    householdSize: 4,
    purchaseCount: 5,
    currentStock: "2kg",
    expectedRunout: "4 days",
    expectedPattern: "regular",
  },
  {
    id: 3,
    description: "Couple — Nescafe Classic 50g, irregular pattern",
    householdSize: 2,
    purchaseCount: 3,
    currentStock: "30g",
    expectedRunout: "25 days",
    expectedPattern: "irregular",
  },
  {
    id: 4,
    description: "New user — only 1 purchase, insufficient data",
    householdSize: 3,
    purchaseCount: 1,
    currentStock: "3kg",
    expectedRunout: "~20 days",
    expectedPattern: "insufficient_data",
  },
  {
    id: 5,
    description: "Family of 4 — Amul butter 100g, bi-weekly purchase",
    householdSize: 4,
    purchaseCount: 5,
    currentStock: "150g",
    expectedRunout: "10 days",
    expectedPattern: "regular",
  },
];

const PATTERN_COLORS: Record<string, string> = {
  regular: "bg-green-100 text-green-700",
  irregular: "bg-amber-100 text-amber-700",
  insufficient_data: "bg-gray-100 text-gray-600",
};

export default function EvalsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Eval Metrics Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Prediction accuracy targets and test fixtures for the Gemini consumption engine
        </p>
      </div>

      {/* Accuracy targets */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">MAE Target</p>
            <p className="text-3xl font-bold text-brand-600 mt-1">
              &lt; {EVAL_TARGETS.maeTarget} days
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Mean absolute error vs. ground truth runout date
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">3-Day Window Target</p>
            <p className="text-3xl font-bold text-brand-600 mt-1">
              ≥ {EVAL_TARGETS.withinThreeDaysPctTarget}%
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Predictions within 3 days of actual runout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How to run */}
      <Card className="mb-8 border-blue-100 bg-blue-50">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-blue-800 mb-1">How to run evals</p>
          <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block">
            pnpm --filter @grocery-tracker/ai eval
          </code>
          <p className="text-xs text-blue-600 mt-2">
            Runs all 5 fixtures against Gemini and prints MAE, 3-day %, and ECE score.
            Exit code 0 = passed, 1 = failed.
          </p>
        </CardContent>
      </Card>

      {/* Fixture table */}
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Test Fixtures ({EVAL_FIXTURES.length} cases)
      </h2>
      <div className="space-y-3">
        {EVAL_FIXTURES.map((fixture) => (
          <Card key={fixture.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">#{fixture.id}</span>
                    <p className="text-sm font-medium text-gray-900">{fixture.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                    <span>Household: {fixture.householdSize}</span>
                    <span>Purchases: {fixture.purchaseCount}</span>
                    <span>Stock: {fixture.currentStock}</span>
                    <span>Expected runout: {fixture.expectedRunout}</span>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                    PATTERN_COLORS[fixture.expectedPattern] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {fixture.expectedPattern.replace("_", " ")}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ECE explanation */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs font-semibold text-gray-600 mb-1">Metrics explained</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>
            <strong>MAE</strong> — Mean Absolute Error in days between predicted and actual runout
          </li>
          <li>
            <strong>3-day window</strong> — % of predictions within ±3 days of ground truth
          </li>
          <li>
            <strong>ECE</strong> — Expected Calibration Error: measures if confidence scores match
            actual accuracy (0 = perfectly calibrated)
          </li>
        </ul>
      </div>
    </div>
  );
}
