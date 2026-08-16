"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Car, DollarSign, User } from "lucide-react";
import { useAuth } from "@/src/lib/auth";
import AppHeader from "@/src/components/AppHeader";
import MobileTopBar from "@/src/components/MobileTopBar";
import BottomTabBar from "@/src/components/BottomTabBar";
import { FullSpinner } from "@/src/components/ui";

const NAV = [
  { href: "/driver", label: "Drive" },
  { href: "/driver/earnings", label: "Earnings" },
  { href: "/driver/account", label: "Account" },
];
const TABS = [
  { href: "/driver", label: "Drive", icon: Car, exact: true },
  { href: "/driver/earnings", label: "Earnings", icon: DollarSign },
  { href: "/driver/account", label: "Account", icon: User },
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
    <div className="flex min-h-[100dvh] flex-col bg-surface-alt">
      <div className="hidden lg:block"><AppHeader nav={NAV} /></div>
      <MobileTopBar accountHref="/driver/account" />
      <main className="flex-1 pb-20 lg:mx-auto lg:w-full lg:max-w-container lg:px-6 lg:py-6 lg:pb-6">{children}</main>
      <BottomTabBar items={TABS} />
    </div>
  );
}
