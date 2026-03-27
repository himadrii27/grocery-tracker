import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 max-w-5xl mx-auto">
        <span className="text-lg font-bold text-brand-700">🛒 GroceryAI</span>
        <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
          Know when you&apos;ll run out of groceries
          <br />
          <span className="text-brand-600">before it happens</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl mx-auto">
          GroceryAI tracks your Swiggy, Blinkit, and Zepto orders, predicts when you&apos;ll run out
          of each item, and makes reordering a single tap.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand-600 text-white font-medium text-base hover:bg-brand-700 transition-colors"
          >
            Try it free →
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-base hover:bg-gray-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                icon: "🧩",
                title: "Install the extension",
                desc: "Add our Chrome extension — it connects to your Swiggy and Blinkit accounts.",
              },
              {
                icon: "🔄",
                title: "Sync once",
                desc: "One click syncs your order history. No account sharing, no manual entry.",
              },
              {
                icon: "🔮",
                title: "Get predictions",
                desc: "AI analyzes your consumption patterns and predicts runouts before they happen.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-2xl mx-auto mb-4">
                  {icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">What you get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: "📅",
                title: "Runout predictions",
                desc: "See a calendar of exactly when each item will run out over the next 30 days.",
              },
              {
                icon: "🛒",
                title: "Reorder links",
                desc: "One-tap links to reorder on Blinkit, Swiggy, or Zepto — no searching.",
              },
              {
                icon: "📊",
                title: "Spending insights",
                desc: "Track your grocery spend by category over time. Know where your money goes.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-gray-200">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-brand-600 hover:text-brand-700 font-medium">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  );
}
