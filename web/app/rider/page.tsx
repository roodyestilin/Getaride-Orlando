"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plane, MapPin, Users, Luggage, Clock, ChevronRight, Navigation } from "lucide-react";
import { api } from "@/src/lib/api";
import { MCO } from "@/src/lib/places";
import type { Place, Ride } from "@/src/lib/types";
import { Button, Card, Badge, Spinner } from "@/src/components/ui";
import PlacePicker from "@/src/components/PlacePicker";
import MapView from "@/src/components/MapView";
import { money } from "@/src/lib/utils";

const ACTIVE = ["searching", "scheduled", "driver_enroute", "arrived", "in_progress"];

function Stepper({ label, icon: Icon, value, setValue, min, max }: any) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-primary" />
        <span className="text-[15px] font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setValue(Math.max(min, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-lg font-bold">−</button>
        <span className="w-6 text-center font-mono text-lg font-bold">{value}</span>
        <button type="button" onClick={() => setValue(Math.min(max, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-lg font-bold">+</button>
      </div>
    </div>
  );
}

export default function RiderHome() {
  const router = useRouter();
  const [dir, setDir] = useState<"to" | "from">("to");
  const [place, setPlace] = useState<Place | null>(null);
  const [pax, setPax] = useState(1);
  const [bags, setBags] = useState(0);
  const [when, setWhen] = useState<"now" | "scheduled">("now");
  const [schedule, setSchedule] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [active, setActive] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActive = useCallback(async () => {
    try {
      const { rides } = await api<{ rides: Ride[] }>("/me/rides");
      setActive(rides.find((r) => ACTIVE.includes(r.status)) || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadActive(); }, [loadActive]);

  const pickup = dir === "from" ? MCO : place;
  const destination = dir === "to" ? MCO : place;

  async function submit() {
    setErr("");
    if (!place) { setErr("Please choose your " + (dir === "to" ? "pickup" : "drop-off") + " location."); return; }
    if (when === "scheduled" && !schedule) { setErr("Please choose a date and time."); return; }
    setSubmitting(true);
    try {
      const body: any = {
        pickup, destination, stops: [], passengers: pax, bags,
        when,
        scheduled_time: when === "scheduled" ? new Date(schedule).toISOString() : null,
      };
      const { ride } = await api<{ ride: Ride }>("/rides", { method: "POST", body });
      router.push(`/rider/ride/${ride.id}`);
    } catch (e: any) {
      setErr(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        {loading ? (
          <Card className="flex h-40 items-center justify-center"><Spinner /></Card>
        ) : active ? (
          <Link href={`/rider/ride/${active.id}`}>
            <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-tertiary"><Navigation className="h-6 w-6 text-brand-primary" /></div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-bold">You have an active ride</p>
                  <Badge tone="brand">{active.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="truncate text-sm text-ink-muted">{active.pickup.label} → {active.destination.label}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-ink-muted" />
            </Card>
          </Link>
        ) : null}

        <Card className="p-5">
          <h1 className="mb-1 text-xl font-bold">Book your airport ride</h1>
          <p className="mb-4 text-sm text-ink-muted">Every trip starts or ends at Orlando Intl (MCO).</p>

          {/* direction */}
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-surface-alt p-1">
            {(["to", "from"] as const).map((d) => (
              <button key={d} onClick={() => setDir(d)} className={`h-10 rounded-full text-sm font-bold transition-colors ${dir === d ? "bg-white text-brand-primary shadow-soft" : "text-ink-muted"}`}>
                {d === "to" ? "To the airport" : "From the airport"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-tertiary/40 px-4 py-3">
              <Plane className="h-4 w-4 text-brand-primary" />
              <span className="text-[15px] font-semibold">{MCO.label}</span>
              <Badge tone="brand" className="ml-auto">{dir === "to" ? "Drop-off" : "Pickup"}</Badge>
            </div>
            <PlacePicker value={place} onChange={setPlace} placeholder={dir === "to" ? "Search pickup location" : "Search drop-off location"} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stepper label="Passengers" icon={Users} value={pax} setValue={setPax} min={1} max={6} />
            <Stepper label="Bags" icon={Luggage} value={bags} setValue={setBags} min={0} max={6} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-surface-alt p-1">
            {(["now", "scheduled"] as const).map((w) => (
              <button key={w} onClick={() => setWhen(w)} className={`h-10 rounded-full text-sm font-bold transition-colors ${when === w ? "bg-white text-brand-primary shadow-soft" : "text-ink-muted"}`}>
                {w === "now" ? "Ride now" : "Schedule"}
              </button>
            ))}
          </div>
          {when === "scheduled" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white px-4">
              <Clock className="h-4 w-4 text-brand-primary" />
              <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="h-12 w-full bg-transparent text-[15px] outline-none" />
            </div>
          )}

          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
          <Button size="lg" className="mt-4 w-full" loading={submitting} onClick={submit}>
            {when === "now" ? "Find drivers" : "Schedule ride"}
          </Button>
        </Card>
      </div>

      <div className="hidden lg:block">
        <Card className="overflow-hidden p-0">
          <MapView pickup={pickup} destination={destination} height={560} />
        </Card>
      </div>
    </div>
  );
}
