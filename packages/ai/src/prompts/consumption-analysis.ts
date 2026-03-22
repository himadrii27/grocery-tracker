interface PurchaseHistoryEntry {
  orderedAt: Date;
  quantityOrdered: number;
  unitSize?: number;
  unitType?: string;
}

interface BuildPredictionPromptParams {
  itemName: string;
  normalizedName: string;
  unitType: string;
  defaultPackSize: number;
  currentEstimatedStock: number;
  householdSize: number;
  purchaseHistory: PurchaseHistoryEntry[];
  today: Date;
}

export function buildPredictionPrompt(params: BuildPredictionPromptParams): string {
  const {
    itemName,
    normalizedName,
    unitType,
    defaultPackSize,
    currentEstimatedStock,
    householdSize,
    purchaseHistory,
    today,
  } = params;

  const historyText = purchaseHistory
    .sort((a, b) => b.orderedAt.getTime() - a.orderedAt.getTime())
    .slice(0, 20) // Last 20 purchases max
    .map((p) => {
      const qty = p.unitSize
        ? `${p.quantityOrdered}x ${p.unitSize}${p.unitType ?? unitType}`
        : `${p.quantityOrdered} units`;
      return `- ${p.orderedAt.toISOString().split("T")[0]}: ordered ${qty}`;
    })
    .join("\n");

  return `You are analyzing grocery consumption patterns for an Indian household.

## Item Details
- Name: ${itemName} (${normalizedName})
- Unit type: ${unitType}
- Pack size: ${defaultPackSize} ${unitType}
- Current estimated stock: ${currentEstimatedStock} ${unitType}
- Household size: ${householdSize} person(s)
- Today's date: ${today.toISOString().split("T")[0]}

## Purchase History (last 6 months, most recent first)
${historyText || "No purchase history available."}

## Instructions
Analyze the purchase frequency and quantities to predict:
1. Average daily consumption in ${unitType}
2. When the current stock will run out
3. Whether to recommend reordering now, soon, or to just monitor

Consider:
- Regular vs. irregular purchase patterns
- Household size (larger household = faster consumption)
- Indian household norms (e.g. milk consumed daily, rice weekly)
- If fewer than 3 purchases, set pattern_type to "insufficient_data" and lower confidence

Submit your prediction using the submit_prediction tool.`;
}
