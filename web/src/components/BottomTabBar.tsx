"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

/** Fixed bottom tab bar for the mobile app experience. Hidden on lg+. */
export default function BottomTabBar({ items }: { items: Tab[] }) {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-white lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className="flex flex-1 flex-col items-center justify-center gap-1">
            <Icon className={cn("h-[22px] w-[22px]", active ? "text-brand-primary" : "text-ink-muted")} strokeWidth={active ? 2.4 : 2} />
            <span className={cn("text-[11px] font-bold", active ? "text-brand-primary" : "text-ink-muted")}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
