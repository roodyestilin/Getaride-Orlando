"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/auth";
import AppHeader from "@/src/components/AppHeader";
import { FullSpinner } from "@/src/components/ui";

const NAV = [
  { href: "/driver", label: "Drive" },
  { href: "/driver/earnings", label: "Earnings" },
  { href: "/driver/account", label: "Account" },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "customer") router.replace("/rider");
  }, [user, loading, router]);
  if (loading || !user) return <FullSpinner />;
  return (
    <div className="min-h-screen bg-surface-alt">
      <AppHeader nav={NAV} />
      <main className="mx-auto max-w-container px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
