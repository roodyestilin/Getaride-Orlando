"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, FullSpinner, Badge } from "@/src/components/ui";
import { money } from "@/src/lib/utils";
import { TrendingUp, Car, Clock, Award } from "lucide-react";

export default function Earnings() {
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => { try { setData(await api("/driver/earnings")); } catch { setData({}); } }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <FullSpinner />;

  const max = Math.max(1, ...(data.days || []).map((d: any) => d.amount));
  const stats = [
    { icon: TrendingUp, label: "This week", value: money(data.week_total) },
    { icon: Car, label: "Trips", value: data.week_trips ?? 0 },
    { icon: Clock, label: "Online hrs", value: data.online_hours ?? 0 },
    { icon: Award, label: "Points", value: data.points ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Earnings</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <s.icon className="h-5 w-5 text-brand-primary" />
            <p className="mt-2 font-mono text-xl font-bold">{s.value}</p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="mb-4 font-bold">This week</p>
        <div className="flex h-40 items-end justify-between gap-2">
          {(data.days || []).map((d: any, i: number) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t-md bg-brand-primary" style={{ height: `${(d.amount / max) * 100}%`, minHeight: d.amount > 0 ? 6 : 0 }} />
              </div>
              <span className="text-xs text-ink-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-3 font-bold">Recent trips</p>
        {(data.trips || []).length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No completed trips yet.</p>}
        <div className="space-y-2">
          {(data.trips || []).map((t: any) => (
            <div key={t.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.pickup} → {t.destination}</p>
                <p className="text-xs text-ink-muted">{t.customer_name} · {t.distance_miles} mi</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold">{money(t.total)}</p>
                {t.tip > 0 && <Badge tone="success">+{money(t.tip)} tip</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
