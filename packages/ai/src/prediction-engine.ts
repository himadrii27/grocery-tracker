import { FunctionCallingMode, type FunctionDeclarationSchema } from "@google/generative-ai";
import { gemini, AI_MODEL } from "./client";
import {
  ConsumptionPredictionSchema,
  consumptionPredictionJsonSchema,
  type ConsumptionPrediction,
} from "./schemas/consumption-prediction";
import { buildPredictionPrompt } from "./prompts/consumption-analysis";
import {
  buildItemNormalizationPrompt,
  normalizeItemsJsonSchema,
} from "./prompts/item-normalizer";

interface PurchaseEntry {
  orderedAt: Date;
  quantityOrdered: number;
  unitSize?: number;
  unitType?: string;
}

interface PredictConsumptionParams {
  userId: string;
  groceryItemId: string;
  itemName: string;
  normalizedName: string;
  unitType: string;
  defaultPackSize: number;
  currentEstimatedStock: number;
  householdSize: number;
  purchaseHistory: PurchaseEntry[];
}

export async function predictConsumption(
  params: PredictConsumptionParams
): Promise<ConsumptionPrediction> {
  const prompt = buildPredictionPrompt({
    ...params,
    today: new Date(),
  });

  const model = gemini.getGenerativeModel({
    model: AI_MODEL,
    tools: [
      {
        functionDeclarations: [
          {
            name: "submit_prediction",
            description: "Submit consumption prediction data",
            parameters: consumptionPredictionJsonSchema as unknown as FunctionDeclarationSchema,
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: ["submit_prediction"],
      },
    },
  });

  const result = await model.generateContent(prompt);
  const part = result.response.candidates?.[0]?.content?.parts?.[0];

  if (!part?.functionCall) {
    throw new Error("Gemini did not call submit_prediction tool");
  }

  const parsed = ConsumptionPredictionSchema.safeParse(part.functionCall.args);
  if (!parsed.success) {
    throw new Error(`Invalid prediction schema: ${parsed.error.message}`);
  }

  return parsed.data;
}

// ─── Batch normalization via Gemini ──────────────────────────────────────────

interface NormalizedItemResult {
  originalName: string;
  normalizedName: string;
  category: string;
  unitType: string;
  defaultPackSize: number;
  confidence: "high" | "medium" | "low";
}

export async function batchNormalizeItems(
  rawNames: string[]
): Promise<NormalizedItemResult[]> {
  if (rawNames.length === 0) return [];

  const prompt = buildItemNormalizationPrompt(rawNames);

  const model = gemini.getGenerativeModel({
    model: AI_MODEL,
    tools: [
      {
        functionDeclarations: [
          {
            name: "normalize_items",
            description: "Submit batch item normalizations",
            parameters: normalizeItemsJsonSchema as unknown as FunctionDeclarationSchema,
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: ["normalize_items"],
      },
    },
  });

  const result = await model.generateContent(prompt);
  const part = result.response.candidates?.[0]?.content?.parts?.[0];

  if (!part?.functionCall) {
    throw new Error("Gemini did not call normalize_items tool");
  }

  const input = part.functionCall.args as { items: NormalizedItemResult[] };
  return input.items;
}
