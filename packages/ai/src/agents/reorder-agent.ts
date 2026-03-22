import type { Content, FunctionDeclaration, Part } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";
import { gemini, AI_MODEL } from "../client";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const REORDER_AGENT_TOOLS: FunctionDeclaration[] = [
  {
    name: "get_current_inventory",
    description: "Get the current estimated stock for a grocery item",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        groceryItemId: { type: SchemaType.STRING, description: "The grocery item ID" },
      },
      required: ["groceryItemId"],
    },
  },
  {
    name: "get_purchase_history",
    description: "Get recent purchase history for a grocery item",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        groceryItemId: { type: SchemaType.STRING },
        daysBack: { type: SchemaType.NUMBER, description: "How many days back to look (default 90)" },
      },
      required: ["groceryItemId"],
    },
  },
  {
    name: "get_user_preferences",
    description: "Get user preferences including platform and notification settings",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userId: { type: SchemaType.STRING },
      },
      required: ["userId"],
    },
  },
  {
    name: "check_platform_availability",
    description: "Check if an item is available on the platform and get its current price",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        groceryItemId: { type: SchemaType.STRING },
        platform: { type: SchemaType.STRING, format: "enum" as const, enum: ["SWIGGY_INSTAMART", "BLINKIT", "ZEPTO"] },
      },
      required: ["groceryItemId", "platform"],
    },
  },
  {
    name: "generate_reorder_deeplink",
    description: "Generate a deep-link URL that opens the platform with the item pre-searched",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        groceryItemId: { type: SchemaType.STRING },
        platform: { type: SchemaType.STRING, format: "enum" as const, enum: ["SWIGGY_INSTAMART", "BLINKIT", "ZEPTO"] },
        quantity: { type: SchemaType.NUMBER, description: "Number of packs to add to cart" },
      },
      required: ["groceryItemId", "platform", "quantity"],
    },
  },
  {
    name: "create_reorder_log",
    description: "Persist the reorder decision and reasoning to the database",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userId: { type: SchemaType.STRING },
        groceryItemId: { type: SchemaType.STRING },
        platform: { type: SchemaType.STRING, format: "enum" as const, enum: ["SWIGGY_INSTAMART", "BLINKIT", "ZEPTO"] },
        quantityOrdered: { type: SchemaType.NUMBER },
        deepLink: { type: SchemaType.STRING },
        reasoning: { type: SchemaType.STRING, description: "Plain-language reasoning shown to user" },
      },
      required: ["userId", "groceryItemId", "platform", "quantityOrdered", "deepLink", "reasoning"],
    },
  },
  {
    name: "send_browser_notification",
    description: "Send a browser push notification to the user",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userId: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING },
        body: { type: SchemaType.STRING },
        deepLink: { type: SchemaType.STRING, description: "URL to open when notification is clicked" },
      },
      required: ["userId", "title", "body"],
    },
  },
];

const SYSTEM_PROMPT = `You are a smart grocery reorder agent for an Indian household.

When triggered for an item, follow this process:
1. Check current inventory stock and purchase history
2. Verify the item is actually critically low (only trigger if stock < 2 days)
3. Get user preferences to find their preferred platform
4. Check platform availability
5. Generate a deep-link to pre-fill the search
6. Log the decision with your reasoning
7. Send a browser notification to the user

Rules:
- Never suggest duplicate reorders within 24h for the same item
- If fewer than 3 purchases in history, do NOT send a notification — just log with status "monitor"
- Always write reasoning in plain, friendly language (shown to the user in the app)
- Be conservative — a missed suggestion is better than an annoying duplicate
- For Indian households: milk/curd = daily; rice/atta = weekly; oils = monthly`;

// ─── Context & Result Types ───────────────────────────────────────────────────

export interface ReorderAgentContext {
  userId: string;
  groceryItemId: string;
  itemName: string;
  predictedRunoutAt: Date;
  currentStockUnits: number;
  tools: {
    getCurrentInventory: (groceryItemId: string) => Promise<{
      estimatedStockUnits: number;
      unitType: string;
    }>;
    getPurchaseHistory: (
      groceryItemId: string,
      daysBack: number
    ) => Promise<Array<{ orderedAt: Date; quantityOrdered: number; priceINR: number }>>;
    getUserPreferences: (userId: string) => Promise<{
      preferredPlatform: string;
      notifyBeforeDays: number;
    }>;
    checkPlatformAvailability: (
      groceryItemId: string,
      platform: string
    ) => Promise<{ available: boolean; priceINR?: number }>;
    generateReorderDeeplink: (
      groceryItemId: string,
      platform: string,
      quantity: number
    ) => Promise<string>;
    createReorderLog: (params: {
      userId: string;
      groceryItemId: string;
      platform: string;
      quantityOrdered: number;
      deepLink: string;
      reasoning: string;
      agentTrace: object;
    }) => Promise<{ id: string }>;
    sendBrowserNotification: (params: {
      userId: string;
      title: string;
      body: string;
      deepLink?: string;
    }) => Promise<void>;
  };
}

export interface ReorderAgentResult {
  action: "link_generated" | "skipped" | "monitor" | "failed";
  deepLink?: string;
  reasoning: string;
  reorderLogId?: string;
  agentTrace: object[];
}

// ─── Agentic Loop ─────────────────────────────────────────────────────────────

export async function runReorderAgent(
  context: ReorderAgentContext
): Promise<ReorderAgentResult> {
  const model = gemini.getGenerativeModel({
    model: AI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: REORDER_AGENT_TOOLS }],
  });

  const history: Content[] = [];
  const agentTrace: object[] = [];

  let reorderLogId: string | undefined;
  let finalReasoning = "";
  let finalAction: ReorderAgentResult["action"] = "monitor";
  let finalDeepLink: string | undefined;

  const chat = model.startChat({ history });

  const firstMessage = `Please analyze and handle a potential reorder for:
- User ID: ${context.userId}
- Item: ${context.itemName} (ID: ${context.groceryItemId})
- Predicted runout: ${context.predictedRunoutAt.toISOString()}
- Current estimated stock: ${context.currentStockUnits} units

Proceed with your analysis and take the appropriate action.`;

  let response = await chat.sendMessage(firstMessage);
  agentTrace.push({ role: "user", content: firstMessage });

  // Agentic loop — max 10 iterations
  for (let iteration = 0; iteration < 10; iteration++) {
    const parts = response.response.candidates?.[0]?.content?.parts ?? [];
    agentTrace.push({ role: "model", parts });

    const functionCallParts = parts.filter((p: Part) => p.functionCall);

    // No tool calls = model is done
    if (functionCallParts.length === 0) {
      const textPart = parts.find((p: Part) => p.text);
      if (textPart?.text) finalReasoning = textPart.text;
      break;
    }

    // Execute each tool call and collect responses
    const functionResponses: Part[] = [];

    for (const part of functionCallParts) {
      const { name, args } = part.functionCall!;
      let result: unknown;

      try {
        switch (name) {
          case "get_current_inventory": {
            const input = args as { groceryItemId: string };
            result = await context.tools.getCurrentInventory(input.groceryItemId);
            break;
          }
          case "get_purchase_history": {
            const input = args as { groceryItemId: string; daysBack?: number };
            result = await context.tools.getPurchaseHistory(
              input.groceryItemId,
              input.daysBack ?? 90
            );
            break;
          }
          case "get_user_preferences": {
            const input = args as { userId: string };
            result = await context.tools.getUserPreferences(input.userId);
            break;
          }
          case "check_platform_availability": {
            const input = args as { groceryItemId: string; platform: string };
            result = await context.tools.checkPlatformAvailability(
              input.groceryItemId,
              input.platform
            );
            break;
          }
          case "generate_reorder_deeplink": {
            const input = args as { groceryItemId: string; platform: string; quantity: number };
            finalDeepLink = await context.tools.generateReorderDeeplink(
              input.groceryItemId,
              input.platform,
              input.quantity
            );
            finalAction = "link_generated";
            result = { deepLink: finalDeepLink };
            break;
          }
          case "create_reorder_log": {
            const input = args as {
              userId: string;
              groceryItemId: string;
              platform: string;
              quantityOrdered: number;
              deepLink: string;
              reasoning: string;
            };
            finalReasoning = input.reasoning;
            const log = await context.tools.createReorderLog({
              ...input,
              agentTrace,
            });
            reorderLogId = log.id;
            result = { id: log.id, status: "created" };
            break;
          }
          case "send_browser_notification": {
            const input = args as {
              userId: string;
              title: string;
              body: string;
              deepLink?: string;
            };
            await context.tools.sendBrowserNotification(input);
            result = { sent: true };
            break;
          }
          default:
            result = { error: `Unknown tool: ${name}` };
        }
      } catch (err) {
        result = { error: String(err) };
      }

      functionResponses.push({
        functionResponse: {
          name,
          response: { result },
        },
      });
    }

    agentTrace.push({ role: "tool", responses: functionResponses });
    response = await chat.sendMessage(functionResponses);
  }

  return {
    action: finalAction,
    deepLink: finalDeepLink,
    reasoning: finalReasoning || "No reasoning provided by agent.",
    reorderLogId,
    agentTrace,
  };
}
