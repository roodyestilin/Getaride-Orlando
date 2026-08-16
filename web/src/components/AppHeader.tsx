"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/auth";
import { Logo } from "./SiteHeader";
import { Avatar } from "./ui";
import { cn } from "@/src/lib/utils";
import { LogOut } from "lucide-react";

export default function AppHeader({ nav }: { nav: { href: string; label: string }[] }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-brand-tertiary text-brand-onTertiary" : "text-ink-soft hover:bg-surface-alt"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold leading-tight">{user?.name}</p>
            <p className="text-xs capitalize text-ink-muted">{user?.role}</p>
          </div>
          <Avatar src={user?.photo} name={user?.name} size={38} />
          <button onClick={() => { logout(); router.push("/"); }} title="Log out" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-3 py-2 sm:hidden">
        {nav.map((n) => {
          const active = pathname === n.href;
          return (
            <Link key={n.href} href={n.href} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold", active ? "bg-brand-tertiary text-brand-onTertiary" : "text-ink-soft")}>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
