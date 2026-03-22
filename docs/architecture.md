# Grocery Tracker AI — Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            GROCERY TRACKER AI                                 │
│                                                                                │
│  Chrome Extension         Web App (Next.js 15)        Background Workers      │
│  ─────────────────        ──────────────────────       ─────────────────────  │
│  Parse Swiggy orders  →   Auth + Dashboard UI    ←→   Inngest cron jobs       │
│  Parse Blinkit orders →   tRPC API + REST API     →   Post-sync predictions   │
│  Permanent token auth →   Supabase via Prisma          Weekly digest (Resend) │
│                                                         Reorder agent (AI)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
grocery-tracker/
├── apps/
│   ├── web/                    Next.js 15 app (dashboard + API)
│   └── extension/              Chrome Extension Manifest V3
├── packages/
│   ├── db/                     Prisma schema + Supabase client
│   ├── ai/                     Gemini AI — predictions, normalization, reorder agent
│   ├── jobs/                   Inngest — cron jobs + event handlers
│   └── shared/                 Zod schemas, item normalizer, shared types
└── docs/
    └── architecture.md         This file
```

---

## Component Map

### `apps/web` — Next.js Web App

| Path | Purpose |
|------|---------|
| `src/app/(auth)/sign-in` | Clerk sign-in page |
| `src/app/(auth)/sign-up` | Clerk sign-up page |
| `src/app/(app)/dashboard` | Main dashboard: stock overview + spending chart |
| `src/app/(app)/inventory` | Inventory grid with stock levels |
| `src/app/(app)/orders` | Paginated order history |
| `src/app/(app)/reorders` | AI-generated reorder suggestions with deep-links |
| `src/app/(app)/settings` | User preferences |
| `src/app/extension-auth` | Generates permanent extension token for Chrome extension |
| `src/app/api/trpc/[trpc]` | tRPC API handler |
| `src/app/api/extension/token` | POST: generate permanent DB token for extension |
| `src/app/api/extension/sync` | POST: receive parsed orders from extension (rate-limited) |
| `src/app/api/extension/sync/[id]` | GET: sync session status (token-authenticated) |
| `src/app/api/webhooks/clerk` | Auto-create User row on Clerk signup |
| `src/app/api/inngest` | Inngest webhook receiver |
| `src/server/api/routers/inventory` | tRPC: stock levels, manual overrides |
| `src/server/api/routers/orders` | tRPC: order history, spending by category |
| `src/server/api/routers/predictions` | tRPC: runout predictions, calendar |
| `src/server/api/routers/reorders` | tRPC: reorder logs, confirm/skip |
| `src/components/charts/SpendingChart` | Recharts stacked bar (client-only via dynamic import) |
| `src/middleware.ts` | Clerk auth guard + public route whitelist |

### `apps/extension` — Chrome Extension (Manifest V3)

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 config — permissions, content script worlds |
| `src/background/service-worker.ts` | Orchestrates sync, stores permanent token |
| `src/content-scripts/swiggy-parser.ts` | Parses Swiggy orders via Redux/DOM/JSON-LD |
| `src/content-scripts/blinkit-interceptor.ts` | Runs in MAIN world — intercepts fetch/XHR before React mounts |
| `src/content-scripts/blinkit-parser.ts` | Runs in ISOLATED world — parses Blinkit widget API response |
| `src/popup/popup.ts` | Sync button, connect account, status display |
| `scripts/build.js` | esbuild bundler — outputs to `dist/` |

### `packages/ai` — AI Integration

| File | Purpose |
|------|---------|
| `src/client.ts` | Gemini API client setup |
| `src/prediction-engine.ts` | `predictConsumption()` + `batchNormalizeItems()` |
| `src/agents/reorder-agent.ts` | `runReorderAgent()` — agentic reorder decision loop |
| `src/prompts/` | System prompts for each AI call |
| `src/schemas/` | Zod schemas for AI tool outputs |
| `src/evals/` | Eval suite for prediction accuracy |

### `packages/jobs` — Inngest Background Jobs

| File | Purpose |
|------|---------|
| `src/inngest-client.ts` | Inngest client + event type definitions |
| `src/prediction-refresh.ts` | Cron @ 6am IST — AI predictions for all users |
| `src/post-sync-predictions.ts` | Event: `grocery/orders.synced` — instant heuristic predictions |
| `src/runout-alert.ts` | Event: `grocery/runout.predicted` — run reorder agent |
| `src/weekly-digest.ts` | Cron @ Sunday 8am IST — email digest via Resend |

### `packages/db` — Database

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | All models, enums, relations |
| `src/client.ts` | Singleton Prisma client |

### `packages/shared` — Shared Utilities

| File | Purpose |
|------|---------|
| `src/types.ts` | Zod schemas + TypeScript types (with input size limits) |
| `src/item-normalizer.ts` | Regex-based name normalization (Layer 1) |

---

## Database Schema

```
User
├── id, clerkId (unique), email, householdSize
├── extensionToken (unique, permanent) ← used by Chrome extension
│
├── UserPreference (1:1)
│   └── preferredPlatform, autoReorderEnabled, notifyBeforeDays
│
├── Order[]
│   ├── platform (SWIGGY_INSTAMART | BLINKIT | ZEPTO)
│   ├── platformOrderId, orderedAt, totalAmountINR, rawPayload
│   └── OrderLineItem[]
│       ├── quantityOrdered, unitSize, unitType, priceINR
│       └── GroceryItem
│           ├── normalizedName (unique), category, unitType, defaultPackSize
│           ├── ConsumptionPrediction[]
│           │   └── avgDailyConsumption, predictedRunoutAt, confidenceScore, reasoning
│           └── ReorderLog[]
│               └── deepLink, platform, quantityOrdered, status, agentTrace (JSON)
│
├── InventoryItem[]
│   └── estimatedStockUnits, runoutPredictedAt
│
└── ReorderRule[]
    └── triggerDaysBefore, preferredPlatform, preferredQuantity
```

---

## Data Flow

### 1. Order Sync — Swiggy

```
User on Swiggy order history page
        │
swiggy-parser.ts (ISOLATED world, document_idle)
  3-layer parse strategy:
  1. Redux state:  window.__REDUX_STATE__.instamartOrder.ordersList
  2. DOM scraping: CSS selectors on order cards
  3. JSON-LD:      <script type="application/ld+json">
        │
Service Worker → POST /api/extension/sync
  Header: Authorization: Bearer <extensionToken>
```

### 2. Order Sync — Blinkit

```
User on blinkit.com/account/orders
        │
blinkit-interceptor.ts (MAIN world, document_start)
  Overrides window.fetch + XMLHttpRequest BEFORE React mounts
  Captures /v1/layout/order_history response
  window.postMessage({ __gt: "BLINKIT_RESPONSE", data })
        │
blinkit-parser.ts (ISOLATED world, document_idle)
  Listens for postMessage from MAIN world
  Parses widget API: snippets → header widget (id/date/total) + horizontal_list (products)
  Skips CANCELLED orders
        │
Service Worker → POST /api/extension/sync  (same endpoint as Swiggy)
```

### 3. Sync API Processing

```
POST /api/extension/sync
  1. Rate limit check (5 req/min per token)
  2. extensionToken → db.user.findUnique()
  3. Zod validation (max 200 orders, field size limits)
  4. De-duplicate by platformOrderId
  5. Normalize item names:
       Layer 1 (regex) → high-confidence
       Layer 2 (Gemini) → low-confidence fallback
  6. Upsert GroceryItem by normalizedName
  7. Create Order + OrderLineItem records
  8. Upsert InventoryItem (increment estimatedStockUnits)
  9. inngest.send("grocery/orders.synced")
  10. Return { sessionId, accepted, duplicates }
```

### 4. Post-Sync Predictions (Heuristic — runs immediately)

```
Event: "grocery/orders.synced"
        │
postSyncPredictionsJob
  For each InventoryItem:
    Non-consumable? (vase, lamp, shorts…) → runoutPredictedAt = null
    Category = OTHER → runoutPredictedAt = null
    Else:
      shelfDays = SHELF_LIFE[category]
        PRODUCE:4, DAIRY:7, FROZEN:30, GRAINS:45,
        BEVERAGES:30, SNACKS:21, CONDIMENTS:60,
        PERSONAL_CARE:75, CLEANING:45
      ≥2 purchases → blend: 60% actual interval + 40% shelf-life
      runoutPredictedAt = lastPurchase.orderedAt + daysToUse
```

### 5. Daily AI Predictions (6am IST)

```
Inngest Cron: "30 0 * * *"
        │
predictionRefreshJob
  For each User → InventoryItem:
    Skip if prediction < 23h old
    Gemini: predictConsumption(purchaseHistory)
      → avgDailyConsumption, predictedRunoutAt, confidenceScore, reasoning
    Save ConsumptionPrediction, update InventoryItem.runoutPredictedAt
    daysLeft ≤ notifyBeforeDays AND confidence ≥ 0.5
      → inngest.send("grocery/runout.predicted")
```

### 6. Reorder Agent

```
Event: "grocery/runout.predicted"
        │
runoutAlertJob
  Dedup: skip if ReorderLog within 24h
  Gemini tool-use agent loop:
    get_current_inventory, get_purchase_history,
    get_user_preferences, check_platform_availability,
    generate_reorder_deeplink, create_reorder_log,
    send_browser_notification
  Saves ReorderLog { deepLink, agentTrace }
```

### 7. Weekly Email Digest (Sunday 8am IST)

```
Inngest Cron: "30 2 * * 0"
        │
weeklyDigestJob (skips if RESEND_API_KEY not set)
  Per user:
    Weekly spend + order count
    Critical items (runout ≤ 0d) + low items (runout ≤ 3d)
    Top spending category
    HTML email (item names HTML-escaped to prevent XSS)
    Send via Resend
```

---

## Auth Flow

### Web App (Clerk)

```
Sign up → Clerk webhook → /api/webhooks/clerk
  Svix HMAC signature verified
  User + UserPreference rows created

Every request → middleware.ts
  Public: /sign-in, /sign-up, /api/webhooks/clerk,
          /api/extension/sync, /extension-auth
  Protected: auth.protect() → 401 if not signed in

tRPC: clerkId → ctx.user (throws UNAUTHORIZED if missing)
All queries include: where: { userId: ctx.user.id }
```

### Extension (Permanent Token)

```
1. User clicks "Connect Account" in popup
2. Opens grocery-tracker.app/extension-auth
3. POST /api/extension/token (Clerk-protected)
     generate 96-char random hex token
     db.user.upsert({ extensionToken: token })
4. Token sent to service worker via chrome.runtime.sendMessage
5. Stored in chrome.storage.local

Sync calls: Authorization: Bearer <token>
API: db.user.findUnique({ extensionToken: token })
Token never expires (replaces short-lived Clerk JWTs that broke sync)
```

---

## Security Controls

| Control | Implementation |
|---------|---------------|
| API auth | Clerk (web) + permanent DB token (extension) |
| Authorization | `userId: ctx.user.id` in every Prisma where-clause |
| Rate limiting | 5 syncs/min per token (in-process Map) |
| Input validation | Zod: max 200 orders, 200 items/order, string/number bounds |
| XSS in emails | `escapeHtml()` on all user-sourced content before HTML interpolation |
| Sync status IDOR | Token auth required on `/api/extension/sync/[id]` |
| Webhook integrity | Svix HMAC on Clerk webhooks |
| Secret storage | All secrets in `.env.local` (gitignored) |

---

## Blinkit Price Handling

Blinkit's widget API returns `totalAmountINR` per order but `priceINR = 0` per line item. The `spendingByCategory` router handles both:

```
if sum(lineItems.priceINR) > 0:   # Swiggy
  use actual per-item prices

elif order.totalAmountINR > 0:    # Blinkit
  distribute equally across unique categories
  perCat = round(totalAmountINR / numCategories)
```

The `SpendingChart` component uses `dynamic(..., { ssr: false })` to avoid a recharts `ResponsiveContainer` issue where DOM width is 0 during server-side render.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Auth | Clerk v5 |
| API | tRPC v11 |
| Database | Supabase (PostgreSQL) + Prisma 5.22 |
| AI | Google Gemini (`@google/generative-ai`) |
| Email | Resend |
| Background Jobs | Inngest v3 |
| Charts | Recharts |
| Extension | Chrome MV3, TypeScript, esbuild |
| Monorepo | pnpm 9 workspaces + Turborepo 2 |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase transaction pooler (port 6543, queries) |
| `DIRECT_URL` | Supabase direct connection (port 5432, migrations) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client-side SDK |
| `CLERK_SECRET_KEY` | Clerk server-side auth |
| `CLERK_WEBHOOK_SECRET` | Svix HMAC for Clerk webhooks |
| `NEXT_PUBLIC_APP_URL` | Base URL for links in emails and auth flows |
| `GEMINI_API_KEY` | Gemini prediction + normalization calls |
| `INNGEST_EVENT_KEY` | Inngest event publishing |
| `INNGEST_SIGNING_KEY` | Verify Inngest webhook signatures |
| `RESEND_API_KEY` | Weekly digest email (optional — skipped if unset) |
| `RESEND_FROM_EMAIL` | Sender address for digest emails |
| `SVIX_API_KEY` | Svix tunnel for local Clerk webhook testing |
