import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TRPCProvider } from "@/trpc/client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <TRPCProvider>
      {/* Mobile: top bar + bottom nav */}
      <MobileNav />

      <div className="flex h-screen bg-gray-50">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Main content — top padding on mobile for the fixed header, bottom for the bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 pt-18 pb-24 md:p-8 md:pt-8 md:pb-8">
          {children}
        </main>
      </div>
    </TRPCProvider>
  );
}
