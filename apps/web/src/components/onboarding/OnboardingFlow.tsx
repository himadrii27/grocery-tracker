"use client";

import { useState, useEffect } from "react";

// Steps the user must complete before seeing their dashboard.
// Steps 1 & 2 are manually acknowledged (we can't detect extension install from the page).
// Step 3 is auto-completed when the parent detects inventory data.
const STEPS = [
  {
    id: "install",
    title: "Install the Chrome Extension",
    description: "The extension reads your order history from Swiggy & Blinkit — no credentials needed.",
  },
  {
    id: "connect",
    title: "Connect Your Account",
    description: "Link the extension to your GroceryAI account so it can send your orders here.",
  },
  {
    id: "sync",
    title: "Sync Your First Orders",
    description: "Trigger a one-tap sync. The extension reads 6 months of order history automatically.",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];
const STORAGE_KEY = "onboarding_done_steps";

function loadDoneSteps(): Set<StepId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as StepId[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDoneSteps(steps: Set<StepId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...steps]));
}

export function OnboardingFlow() {
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [openStep, setOpenStep] = useState<StepId>("install");
  const [hydrated, setHydrated] = useState(false);

  // Load persisted progress after hydration to avoid SSR mismatch
  useEffect(() => {
    const saved = loadDoneSteps();
    setDoneSteps(saved);
    setHydrated(true);
    // Auto-open the first incomplete step
    for (const step of STEPS) {
      if (!saved.has(step.id)) {
        setOpenStep(step.id);
        break;
      }
    }
  }, []);

  function markDone(stepId: StepId) {
    const next = new Set(doneSteps);
    next.add(stepId);
    setDoneSteps(next);
    saveDoneSteps(next);
    // Advance to next incomplete step
    const nextStep = STEPS.find((s) => !next.has(s.id));
    if (nextStep) setOpenStep(nextStep.id);
  }

  if (!hydrated) return null;

  const completedCount = doneSteps.size;
  const allDone = completedCount === STEPS.length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to GroceryAI</h1>
        <p className="text-gray-500 mt-2">
          3 quick steps to set up automatic runout predictions
        </p>
        {/* Progress bar */}
        <div className="mt-6 flex items-center gap-2 justify-center">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  doneSteps.has(step.id)
                    ? "bg-brand-600 text-white"
                    : openStep === step.id
                    ? "bg-brand-100 text-brand-700 border-2 border-brand-400"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {doneSteps.has(step.id) ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-12 rounded transition-colors ${
                    doneSteps.has(step.id) ? "bg-brand-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-400 mt-3">{completedCount} of {STEPS.length} done</p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {/* ── Step 1: Install Extension ── */}
        <StepCard
          stepId="install"
          index={1}
          title={STEPS[0].title}
          description={STEPS[0].description}
          done={doneSteps.has("install")}
          open={openStep === "install"}
          onToggle={() => setOpenStep(openStep === "install" ? "sync" : "install")}
          onDone={() => markDone("install")}
          doneLabel="I've installed the extension"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Load the extension from your local build:</p>
            <ol className="space-y-3">
              <Step number={1}>
                Open Chrome and go to{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  chrome://extensions
                </code>
              </Step>
              <Step number={2}>
                Toggle <strong>Developer mode</strong> on (top-right corner of the page)
              </Step>
              <Step number={3}>
                Click <strong>Load unpacked</strong> and select this folder:
                <div className="mt-2 bg-gray-900 text-green-400 rounded-lg px-4 py-3 font-mono text-xs">
                  grocery-tracker/apps/extension/dist
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Run <code className="bg-gray-100 px-1 py-0.5 rounded">pnpm --filter extension build</code> first if the dist folder doesn&apos;t exist.
                </p>
              </Step>
              <Step number={4}>
                You should see a <strong>🛒 GroceryAI</strong> icon appear in your Chrome toolbar.
                If it&apos;s hidden, click the puzzle piece icon and pin it.
              </Step>
            </ol>
          </div>
        </StepCard>

        {/* ── Step 2: Connect Account ── */}
        <StepCard
          stepId="connect"
          index={2}
          title={STEPS[1].title}
          description={STEPS[1].description}
          done={doneSteps.has("connect")}
          open={openStep === "connect"}
          onToggle={() => setOpenStep(openStep === "connect" ? "install" : "connect")}
          onDone={() => markDone("connect")}
          doneLabel="My account is connected"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Link the extension to this account:</p>
            <ol className="space-y-3">
              <Step number={1}>
                Click the <strong>🛒 GroceryAI</strong> icon in your Chrome toolbar
              </Step>
              <Step number={2}>
                In the popup, click <strong>Connect Account</strong>
              </Step>
              <Step number={3}>
                A tab will open on this website. It sends a secure token to the extension automatically — you don&apos;t need to do anything on that page.
              </Step>
              <Step number={4}>
                Once you see <strong>✅ Extension Connected!</strong>, come back here.
              </Step>
            </ol>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-800 text-xs">
              <strong>Why this step?</strong> The extension needs to know who you are so it sends orders to the right account. The token is stored locally in the extension — your password is never shared.
            </div>
          </div>
        </StepCard>

        {/* ── Step 3: Sync Orders ── */}
        <StepCard
          stepId="sync"
          index={3}
          title={STEPS[2].title}
          description={STEPS[2].description}
          done={doneSteps.has("sync")}
          open={openStep === "sync"}
          onToggle={() => setOpenStep(openStep === "sync" ? "install" : "sync")}
          onDone={() => markDone("sync")}
          doneLabel="I've started a sync"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Sync 6 months of orders in one tap:</p>
            <ol className="space-y-3">
              <Step number={1}>
                Click the <strong>🛒 GroceryAI</strong> icon in your Chrome toolbar
              </Step>
              <Step number={2}>
                Click <strong>Sync from Swiggy Instamart</strong> or <strong>Sync from Blinkit</strong>
              </Step>
              <Step number={3}>
                The extension will briefly open the order history page in the background, read your orders, then close it. You&apos;ll see a progress indicator in the popup.
              </Step>
              <Step number={4}>
                Come back to this tab. Your inventory will appear within a few seconds.
              </Step>
            </ol>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-800 text-xs">
              <strong>Tip:</strong> Sync takes 10–30 seconds depending on how many orders you have. You can sync both Swiggy and Blinkit — your inventory will merge automatically.
            </div>
          </div>
        </StepCard>
      </div>

      {/* All done state */}
      {allDone && (
        <div className="mt-6 text-center bg-brand-50 border border-brand-200 rounded-2xl p-6">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-semibold text-brand-800">All set! Waiting for your first sync...</p>
          <p className="text-sm text-brand-700 mt-1">
            Your dashboard will populate automatically once the extension sends your orders.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StepCard({
  stepId,
  index,
  title,
  description,
  done,
  open,
  onToggle,
  onDone,
  doneLabel,
  children,
}: {
  stepId: StepId;
  index: number;
  title: string;
  description: string;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
  doneLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border transition-all ${
        done
          ? "bg-brand-50 border-brand-200"
          : open
          ? "bg-white border-brand-300 shadow-md"
          : "bg-white border-gray-200"
      }`}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div
          className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
            done
              ? "bg-brand-600 text-white"
              : open
              ? "bg-brand-100 text-brand-700"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {done ? "✓" : index}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${done ? "text-brand-800" : "text-gray-900"}`}>
            {title}
            {done && <span className="ml-2 text-xs font-normal text-brand-600">Done</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className={`text-gray-400 text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {open && !done && (
        <div className="px-5 pb-5">
          <div className="border-t border-gray-100 pt-4 mb-5">{children}</div>
          <button
            onClick={onDone}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ {doneLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}
