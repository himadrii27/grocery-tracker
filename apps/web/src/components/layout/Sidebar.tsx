"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const NAV_ITEMS = [
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <span className="text-lg font-bold text-brand-700">🛒 GroceryAI</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}
