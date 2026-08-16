"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/auth";
import AppHeader from "@/src/components/AppHeader";
import { FullSpinner } from "@/src/components/ui";

const NAV = [
  { href: "/rider", label: "Ride" },
  { href: "/rider/activity", label: "Activity" },
  { href: "/rider/account", label: "Account" },
];

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "driver") router.replace("/driver");
  }, [user, loading, router]);

  if (loading || !user) return <FullSpinner />;

  return (
    <div className="min-h-screen bg-surface-alt">
      <AppHeader nav={NAV} />
      <main className="mx-auto max-w-container px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
