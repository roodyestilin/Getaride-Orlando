"use client";

import Link from "next/link";
import { Car } from "lucide-react";
import { useAuth } from "@/src/lib/auth";
import { Avatar } from "./ui";

/** Slim mobile top bar matching the native app header. Hidden on lg+. */
export default function MobileTopBar({ accountHref }: { accountHref?: string }) {
  const { user } = useAuth();
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary">
          <Car className="h-5 w-5 text-white" />
        </span>
        <span className="text-lg font-bold text-ink">
          Getaride <span className="text-brand-primary">Orlando</span>
        </span>
      </div>
      {accountHref && (
        <Link href={accountHref}>
          <Avatar src={user?.photo} name={user?.name} size={34} />
        </Link>
      )}
    </div>
  );
}
