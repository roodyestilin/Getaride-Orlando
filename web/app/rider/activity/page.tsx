"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plane, MapPin } from "lucide-react";
import { api } from "@/src/lib/api";
import type { Ride } from "@/src/lib/types";
import { Card, Badge, FullSpinner } from "@/src/components/ui";
import { money } from "@/src/lib/utils";

const TONE: Record<string, any> = { completed: "success", cancelled: "danger", scheduled: "warning" };

export default function Activity() {
  const [rides, setRides] = useState<Ride[] | null>(null);

  const load = useCallback(async () => {
    try { const { rides } = await api<{ rides: Ride[] }>("/me/rides"); setRides(rides); }
    catch { setRides([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!rides) return <FullSpinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Your rides</h1>
      {rides.length === 0 && (
        <Card className="p-10 text-center text-ink-muted">No rides yet. Book your first airport ride!</Card>
      )}
      <div className="space-y-3">
        {rides.map((r) => (
          <Link key={r.id} href={`/rider/ride/${r.id}`}>
            <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tertiary">
                {r.pickup.airport ? <Plane className="h-5 w-5 text-brand-primary" /> : <MapPin className="h-5 w-5 text-brand-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.pickup.label} → {r.destination.label}</p>
                <p className="text-xs text-ink-muted">{r.created_at ? new Date(r.created_at * 1000).toLocaleDateString() : ""} · {r.distance_miles} mi</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold">{money(r.final_fare || r.recommended_fare)}</p>
                <Badge tone={TONE[r.status] || "muted"}>{r.status.replace(/_/g, " ")}</Badge>
              </div>
              <ChevronRight className="h-5 w-5 text-ink-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
