/**
 * Eval harness for the consumption prediction engine.
 *
 * Validates prediction accuracy BEFORE enabling suggestions for users.
 * Minimum bar: MAE < 1.5 days, 85% of predictions within 3-day window.
 *
 * Run: pnpm --filter @grocery-tracker/ai eval
 */

import { predictConsumption } from "../prediction-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvalFixture {
  description: string;
  params: {
    itemName: string;
    normalizedName: string;
    unitType: string;
    defaultPackSize: number;
    currentEstimatedStock: number;
    householdSize: number;
    purchaseHistory: Array<{
      orderedAt: Date;
      quantityOrdered: number;
      unitSize?: number;
    }>;
  };
  expectedRunoutDate: Date; // Ground truth
}

export interface EvalMetrics {
  totalCases: number;
  meanAbsoluteErrorDays: number;
  withinThreeDaysPct: number;   // Target: >85%
  confidenceCalibration: number; // ECE score (0 = perfect)
  passed: boolean;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Synthetic fixtures: 4 household archetypes × representative items
// Ground truth based on known consumption rates

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

export const EVAL_FIXTURES: EvalFixture[] = [
  // ── Archetype 1: Single professional, regular milk buyer ──
  {
    description: "Single professional — Amul milk 500ml, daily consumption",
    params: {
      itemName: "Amul Taaza Toned Milk 500ml",
      normalizedName: "amul-toned-milk-500ml",
      unitType: "ml",
      defaultPackSize: 500,
      currentEstimatedStock: 1500, // 3 packets
      householdSize: 1,
      purchaseHistory: [
        { orderedAt: daysAgo(7), quantityOrdered: 4 },
        { orderedAt: daysAgo(14), quantityOrdered: 4 },
        { orderedAt: daysAgo(21), quantityOrdered: 6 },
        { orderedAt: daysAgo(30), quantityOrdered: 4 },
        { orderedAt: daysAgo(40), quantityOrdered: 4 },
      ],
    },
    expectedRunoutDate: daysFromNow(5), // purchase history: ~335ml/day → 1500ml ÷ 335 ≈ 4.5 days
  },

  // ── Archetype 2: Family of 4, weekly rice purchase ──
  {
    description: "Family of 4 — Basmati rice 5kg, weekly purchase",
    params: {
      itemName: "India Gate Basmati Rice 5kg",
      normalizedName: "basmati-rice-5kg",
      unitType: "g",
      defaultPackSize: 5000,
      currentEstimatedStock: 2000, // ~2kg remaining
      householdSize: 4,
      purchaseHistory: [
        { orderedAt: daysAgo(10), quantityOrdered: 1 },
        { orderedAt: daysAgo(22), quantityOrdered: 1 },
        { orderedAt: daysAgo(34), quantityOrdered: 2 },
        { orderedAt: daysAgo(45), quantityOrdered: 1 },
        { orderedAt: daysAgo(56), quantityOrdered: 1 },
      ],
    },
    expectedRunoutDate: daysFromNow(4), // 2kg ÷ ~500g/day for family of 4
  },

  // ── Archetype 3: Couple, irregular coffee buyer ──
  {
    description: "Couple — Nescafe Classic 50g, irregular pattern",
    params: {
      itemName: "Nescafe Classic 50g",
      normalizedName: "nescafe-classic-50g",
      unitType: "g",
      defaultPackSize: 50,
      currentEstimatedStock: 30,
      householdSize: 2,
      purchaseHistory: [
        { orderedAt: daysAgo(30), quantityOrdered: 1 },
        { orderedAt: daysAgo(65), quantityOrdered: 2 },
        { orderedAt: daysAgo(100), quantityOrdered: 1 },
      ],
    },
    expectedRunoutDate: daysFromNow(15), // 200g over 100 days = 2g/day → 30g ÷ 2g/day = 15 days
  },

  // ── Archetype 4: Insufficient data ──
  {
    description: "New user — only 1 purchase, insufficient data",
    params: {
      itemName: "Aashirvaad Atta 5kg",
      normalizedName: "aashirvaad-atta-5kg",
      unitType: "g",
      defaultPackSize: 5000,
      currentEstimatedStock: 3000,
      householdSize: 3,
      purchaseHistory: [
        { orderedAt: daysAgo(15), quantityOrdered: 1 },
      ],
    },
    expectedRunoutDate: daysFromNow(22), // 5000g bought 15d ago, 3000g remain → 133g/day → 22.5 days
  },

  // ── Archetype 5: Family of 4, butter consumption ──
  {
    description: "Family of 4 — Amul butter 100g, bi-weekly purchase",
    params: {
      itemName: "Amul Butter 100g",
      normalizedName: "amul-butter-100g",
      unitType: "g",
      defaultPackSize: 100,
      currentEstimatedStock: 150,
      householdSize: 4,
      purchaseHistory: [
        { orderedAt: daysAgo(14), quantityOrdered: 2 },
        { orderedAt: daysAgo(28), quantityOrdered: 2 },
        { orderedAt: daysAgo(42), quantityOrdered: 3 },
        { orderedAt: daysAgo(56), quantityOrdered: 2 },
        { orderedAt: daysAgo(72), quantityOrdered: 2 },
      ],
    },
    expectedRunoutDate: daysFromNow(10), // ~15g/day = 10 days on 150g
  },
];

// ─── Eval Runner ──────────────────────────────────────────────────────────────

export async function runPredictionEval(
  fixtures: EvalFixture[] = EVAL_FIXTURES
): Promise<EvalMetrics> {
  console.log(`Running prediction eval on ${fixtures.length} fixtures...`);

  const results: Array<{
    fixture: EvalFixture;
    errorDays: number;
    withinThreeDays: boolean;
    confidence: number;
    actualProbability: number; // 1 if within 3 days, 0 if not
  }> = [];

  for (const fixture of fixtures) {
    console.log(`  Testing: ${fixture.description}`);

    try {
      const prediction = await predictConsumption({
        userId: "eval-user",
        groceryItemId: "eval-item",
        ...fixture.params,
      });

      const predictedDate = new Date(prediction.predictedRunoutAt);
      const expectedDate = fixture.expectedRunoutDate;
      const errorDays = Math.abs(
        (predictedDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const withinThreeDays = errorDays <= 3;

      results.push({
        fixture,
        errorDays,
        withinThreeDays,
        confidence: prediction.confidenceScore,
        actualProbability: withinThreeDays ? 1 : 0,
      });

      console.log(
        `    Error: ${errorDays.toFixed(1)} days, within 3 days: ${withinThreeDays}, confidence: ${prediction.confidenceScore.toFixed(2)}`
      );
    } catch (err) {
      console.error(`    FAILED: ${err}`);
      results.push({
        fixture,
        errorDays: 999, // Large error for failures
        withinThreeDays: false,
        confidence: 0,
        actualProbability: 0,
      });
    }
  }

  const totalCases = results.length;
  const meanAbsoluteErrorDays =
    results.reduce((sum, r) => sum + r.errorDays, 0) / totalCases;
  const withinThreeDaysPct =
    (results.filter((r) => r.withinThreeDays).length / totalCases) * 100;

  // Expected Calibration Error (ECE) — lower is better
  const confidenceCalibration = computeECE(
    results.map((r) => r.confidence),
    results.map((r) => r.actualProbability)
  );

  const passed =
    meanAbsoluteErrorDays < 1.5 && withinThreeDaysPct >= 85;

  const metrics: EvalMetrics = {
    totalCases,
    meanAbsoluteErrorDays,
    withinThreeDaysPct,
    confidenceCalibration,
    passed,
  };

  console.log("\nEval Results:");
  console.log(`  Total cases: ${totalCases}`);
  console.log(`  MAE: ${meanAbsoluteErrorDays.toFixed(2)} days (target: <1.5)`);
  console.log(`  Within 3 days: ${withinThreeDaysPct.toFixed(1)}% (target: ≥85%)`);
  console.log(`  ECE: ${confidenceCalibration.toFixed(3)}`);
  console.log(`  PASSED: ${passed}`);

  return metrics;
}

function computeECE(confidences: number[], actuals: number[], bins = 10): number {
  const binSize = 1 / bins;
  let ece = 0;
  let total = confidences.length;

  for (let i = 0; i < bins; i++) {
    const lower = i * binSize;
    const upper = (i + 1) * binSize;
    const inBin = confidences
      .map((c, idx) => ({ conf: c, actual: actuals[idx] }))
      .filter((x) => x.conf >= lower && x.conf < upper);

    if (inBin.length === 0) continue;
    const avgConf = inBin.reduce((s, x) => s + x.conf, 0) / inBin.length;
    const avgActual = inBin.reduce((s, x) => s + x.actual, 0) / inBin.length;
    ece += (inBin.length / total) * Math.abs(avgConf - avgActual);
  }

  return ece;
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

if (require.main === module) {
  runPredictionEval().then((metrics) => {
    process.exit(metrics.passed ? 0 : 1);
  });
}
