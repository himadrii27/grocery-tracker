"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const BOTTOM_NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/inventory", label: "Stock", icon: "📦" },
  { href: "/predictions", label: "Predict", icon: "🗓️" },
  { href: "/reorders", label: "Reorders", icon: "🔄" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const ALL_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/orders", label: "Orders", icon: "🧾" },
  { href: "/reorders", label: "Reorders", icon: "🔄" },
  { href: "/predictions", label: "Predictions", icon: "🗓️" },
  { href: "/shopping-list", label: "Shopping List", icon: "🛍️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/onboarding", label: "Setup Guide", icon: "🧩" },
  { href: "/admin/evals", label: "Eval Metrics", icon: "🧪" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* ── Top header bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <span className="text-base font-bold text-brand-700">🛒 GroceryAI</span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* ── Slide-out drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-base font-bold text-brand-700">🛒 GroceryAI</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {ALL_NAV.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-gray-100">
              <UserButton />
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom nav bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        {BOTTOM_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? "text-brand-600" : "text-gray-400"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
