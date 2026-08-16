"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car } from "lucide-react";
import { useAuth } from "@/src/lib/auth";
import { Button, Avatar } from "./ui";

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary">
        <Car className="h-5 w-5 text-white" />
      </span>
      <span className={`text-lg font-bold ${light ? "text-white" : "text-ink"}`}>Getaride</span>
    </Link>
  );
}

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const appHref = user ? (user.role === "driver" ? "/driver" : "/rider") : "/rider";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/rider" className="text-sm font-semibold text-ink-soft hover:text-brand-primary">Ride</Link>
            <Link href="/drive" className="text-sm font-semibold text-ink-soft hover:text-brand-primary">Drive</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href={appHref} className="hidden md:block">
                <Button variant="light" size="sm">Open app</Button>
              </Link>
              <button onClick={() => { logout(); router.push("/"); }} className="flex items-center gap-2">
                <Avatar src={user.photo} name={user.name} size={36} />
              </button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
              <Link href="/signup"><Button variant="primary" size="sm">Sign up</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
