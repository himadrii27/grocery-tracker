import { z } from "zod";

export const ConsumptionPredictionSchema = z.object({
  avgDailyConsumptionUnits: z
    .number()
    .positive()
    .describe("Average daily consumption in the item's native unit"),
  predictedRunoutAt: z
    .string()
    .datetime()
    .describe("ISO 8601 datetime when stock will run out"),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the prediction (0.0 = no confidence, 1.0 = certain)"),
  reasoning: z
    .string()
    .describe("Plain-language explanation of the prediction, shown to the user"),
  contextFactors: z.object({
    patternType: z.enum(["regular", "irregular", "seasonal", "insufficient_data"]),
    seasonalAdjustment: z.number().optional().describe("Multiplier applied for seasonal variation"),
  }),
  recommendation: z
    .enum(["reorder_now", "reorder_soon", "monitor", "skip"])
    .describe("Action to take"),
});

export type ConsumptionPrediction = z.infer<typeof ConsumptionPredictionSchema>;

// Convert Zod schema to JSON Schema for Claude tool_use
export const consumptionPredictionJsonSchema = {
  type: "object",
  properties: {
    avgDailyConsumptionUnits: {
      type: "number",
      description: "Average daily consumption in the item's native unit",
    },
    predictedRunoutAt: {
      type: "string",
      format: "date-time",
      description: "ISO 8601 datetime when stock will run out",
    },
    confidenceScore: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence in the prediction (0.0–1.0)",
    },
    reasoning: {
      type: "string",
      description: "Plain-language explanation of the prediction",
    },
    contextFactors: {
      type: "object",
      properties: {
        patternType: {
          type: "string",
          enum: ["regular", "irregular", "seasonal", "insufficient_data"],
        },
        seasonalAdjustment: {
          type: "number",
          description: "Multiplier applied for seasonal variation",
        },
      },
      required: ["patternType"],
    },
    recommendation: {
      type: "string",
      enum: ["reorder_now", "reorder_soon", "monitor", "skip"],
      description: "Action to take",
    },
  },
  required: [
    "avgDailyConsumptionUnits",
    "predictedRunoutAt",
    "confidenceScore",
    "reasoning",
    "contextFactors",
    "recommendation",
  ],
} as const;

// ─── Item Normalization Schema ────────────────────────────────────────────────

export const ItemNormalizationSchema = z.object({
  normalizedName: z.string().describe("Stable slug, e.g. 'amul-toned-milk-500ml'"),
  category: z.enum([
    "DAIRY",
    "PRODUCE",
    "GRAINS",
    "BEVERAGES",
    "SNACKS",
    "PERSONAL_CARE",
    "CLEANING",
    "FROZEN",
    "CONDIMENTS",
    "OTHER",
  ]),
  unitType: z.enum(["ml", "g", "pieces", "kg"]),
  defaultPackSize: z.number().positive(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ItemNormalization = z.infer<typeof ItemNormalizationSchema>;

export const itemNormalizationJsonSchema = {
  type: "object",
  properties: {
    normalizedName: {
      type: "string",
      description: "Stable slug, e.g. 'amul-toned-milk-500ml'",
    },
    category: {
      type: "string",
      enum: [
        "DAIRY",
        "PRODUCE",
        "GRAINS",
        "BEVERAGES",
        "SNACKS",
        "PERSONAL_CARE",
        "CLEANING",
        "FROZEN",
        "CONDIMENTS",
        "OTHER",
      ],
    },
    unitType: { type: "string", enum: ["ml", "g", "pieces", "kg"] },
    defaultPackSize: { type: "number" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["normalizedName", "category", "unitType", "defaultPackSize", "confidence"],
} as const;
