"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/auth";
import { Card, Avatar, Button, Badge } from "@/src/components/ui";
import { Star, Mail, Car, LogOut, ShieldCheck } from "lucide-react";

export default function DriverAccount() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const approval = user?.approval_status || "approved";
  const tone = approval === "approved" ? "success" : approval === "pending" ? "warning" : "danger";

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pt-4 lg:px-0 lg:pt-0">
      <h1 className="text-2xl font-bold">Account</h1>
      <Card className="flex items-center gap-4 p-5">
        <Avatar src={user?.photo} name={user?.name} size={72} />
        <div>
          <p className="text-xl font-bold">{user?.name}</p>
          <p className="flex items-center gap-1 text-sm text-ink-muted"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {user?.rating?.toFixed(1) ?? "5.0"}</p>
          <Badge tone={tone as any} className="mt-1"><ShieldCheck className="h-3 w-3" /> {approval}</Badge>
        </div>
      </Card>
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-ink-muted" /> {user?.email}</div>
        <div className="flex items-center gap-3 text-sm"><Car className="h-4 w-4 text-ink-muted" /> {user?.color} {user?.vehicle} · {user?.plate}</div>
        {user?.vehicle_class_label && <Badge tone="brand">{user.vehicle_class_label}</Badge>}
      </Card>
      <Button variant="light" className="w-full text-danger" onClick={() => { logout(); router.push("/"); }}>
        <LogOut className="h-4 w-4" /> Log out
      </Button>
    </div>
  );
}
