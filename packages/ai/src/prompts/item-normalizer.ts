export function buildItemNormalizationPrompt(rawNames: string[]): string {
  const itemsList = rawNames
    .map((name, i) => `${i + 1}. "${name}"`)
    .join("\n");

  return `You are a grocery item normalization system for Indian quick-commerce platforms (Swiggy Instamart, Blinkit, Zepto).

Convert these raw product names into standardized identifiers:

${itemsList}

For each item, determine:
1. A stable slug (e.g., "amul-toned-milk-500ml") — lowercase, hyphen-separated, includes brand + variant + size
2. Category (DAIRY, PRODUCE, GRAINS, BEVERAGES, SNACKS, PERSONAL_CARE, CLEANING, FROZEN, CONDIMENTS, OTHER, NON_CONSUMABLE)
3. Unit type (ml, g, pieces, kg)
4. Default pack size in that unit
5. Confidence in your categorization (high/medium/low)

Rules:
- Always include size in the slug if it's part of the product identity
- For produce/unbranded items, omit brand (e.g., "banana-dozen" not "big-bazaar-banana")
- Prefer the most common Indian brand name spelling
- Use NON_CONSUMABLE for items that don't get consumed/run out: clothing, apparel, footwear, electronics, accessories, toys, home décor, utensils, books, stationery

Use the normalize_items tool to submit all normalizations as an array.`;
}

export const normalizeItemsJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          originalName: { type: "string" },
          normalizedName: { type: "string" },
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
              "NON_CONSUMABLE",
            ],
          },
          unitType: { type: "string", enum: ["ml", "g", "pieces", "kg"] },
          defaultPackSize: { type: "number" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: [
          "originalName",
          "normalizedName",
          "category",
          "unitType",
          "defaultPackSize",
          "confidence",
        ],
      },
    },
  },
  required: ["items"],
} as const;
