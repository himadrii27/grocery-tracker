/**
 * Item name normalization utilities.
 * Converts raw platform product names to a stable slug used as GroceryItem.normalizedName.
 *
 * Normalization layers (in order):
 * 1. Regex rules for known patterns
 * 2. Claude Haiku fallback for ambiguous names (handled in packages/ai)
 */

interface NormalizationRule {
  pattern: RegExp;
  normalized: string;
  category: string;
  unitType: string;
  defaultPackSize: number;
}

const NORMALIZATION_RULES: NormalizationRule[] = [
  // Dairy
  {
    pattern: /amul\s+(taaza|toned)\s+milk\s*[,\s]*500\s*ml/i,
    normalized: "amul-toned-milk-500ml",
    category: "DAIRY",
    unitType: "ml",
    defaultPackSize: 500,
  },
  {
    pattern: /amul\s+(taaza|toned)\s+milk\s*[,\s]*1\s*l(itre)?/i,
    normalized: "amul-toned-milk-1l",
    category: "DAIRY",
    unitType: "ml",
    defaultPackSize: 1000,
  },
  {
    pattern: /amul\s+gold\s+milk\s*[,\s]*500\s*ml/i,
    normalized: "amul-gold-milk-500ml",
    category: "DAIRY",
    unitType: "ml",
    defaultPackSize: 500,
  },
  {
    pattern: /amul\s+butter\s*[,\s]*100\s*g/i,
    normalized: "amul-butter-100g",
    category: "DAIRY",
    unitType: "g",
    defaultPackSize: 100,
  },
  {
    pattern: /amul\s+paneer\s*[,\s]*200\s*g/i,
    normalized: "amul-paneer-200g",
    category: "DAIRY",
    unitType: "g",
    defaultPackSize: 200,
  },
  // Eggs
  {
    pattern: /egg[s]?\s*[,\s]*(white|brown)?\s*[,\s]*(\d+)\s*(pieces?|pcs?)/i,
    normalized: "eggs-tray",
    category: "DAIRY",
    unitType: "pieces",
    defaultPackSize: 12,
  },
  // Bread
  {
    pattern: /britannia\s+bread\s*(white|brown)?\s*[,\s]*400\s*g/i,
    normalized: "britannia-bread-400g",
    category: "GRAINS",
    unitType: "g",
    defaultPackSize: 400,
  },
  // Rice
  {
    pattern: /basmati\s+rice\s*[,\s]*1\s*kg/i,
    normalized: "basmati-rice-1kg",
    category: "GRAINS",
    unitType: "g",
    defaultPackSize: 1000,
  },
  {
    pattern: /basmati\s+rice\s*[,\s]*5\s*kg/i,
    normalized: "basmati-rice-5kg",
    category: "GRAINS",
    unitType: "g",
    defaultPackSize: 5000,
  },
  // Beverages
  {
    pattern: /nescafe\s+classic\s*[,\s]*50\s*g/i,
    normalized: "nescafe-classic-50g",
    category: "BEVERAGES",
    unitType: "g",
    defaultPackSize: 50,
  },
  {
    pattern: /tata\s+(tea|chai)\s*(gold|premium)?\s*[,\s]*100\s*g/i,
    normalized: "tata-tea-100g",
    category: "BEVERAGES",
    unitType: "g",
    defaultPackSize: 100,
  },
  // Cooking oil
  {
    pattern: /fortune\s+sunflower\s+oil\s*[,\s]*1\s*l/i,
    normalized: "fortune-sunflower-oil-1l",
    category: "CONDIMENTS",
    unitType: "ml",
    defaultPackSize: 1000,
  },
  // Atta / flour
  {
    pattern: /aashirvaad\s+atta\s*[,\s]*5\s*kg/i,
    normalized: "aashirvaad-atta-5kg",
    category: "GRAINS",
    unitType: "g",
    defaultPackSize: 5000,
  },
];

export interface NormalizedItem {
  normalizedName: string;
  category: string;
  unitType: string;
  defaultPackSize: number;
  confidence: "high" | "low";
}

/**
 * Attempt to normalize a product name using regex rules.
 * Returns null if no rule matches (caller should use Claude fallback).
 */
export function normalizeItemName(rawName: string): NormalizedItem | null {
  const cleaned = rawName.trim();

  for (const rule of NORMALIZATION_RULES) {
    if (rule.pattern.test(cleaned)) {
      return {
        normalizedName: rule.normalized,
        category: rule.category,
        unitType: rule.unitType,
        defaultPackSize: rule.defaultPackSize,
        confidence: "high",
      };
    }
  }

  // Fallback: generate a deterministic slug from the raw name
  // (will be overridden by Claude if AI normalization is enabled)
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return {
    normalizedName: slug,
    category: "OTHER",
    unitType: "pieces",
    defaultPackSize: 1,
    confidence: "low",
  };
}

/**
 * Fuzzy match a normalized name against an existing catalog.
 * Returns the best match if similarity is above threshold.
 */
export function fuzzyMatchCatalog(
  normalizedName: string,
  catalog: string[],
  threshold = 0.8
): string | null {
  if (catalog.includes(normalizedName)) return normalizedName;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const catalogItem of catalog) {
    const score = jaccardSimilarity(normalizedName, catalogItem);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = catalogItem;
    }
  }

  return bestMatch;
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split("-"));
  const tokensB = new Set(b.split("-"));
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.size / union.size;
}
