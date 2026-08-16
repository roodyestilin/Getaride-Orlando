"use client";

import { useCallback, useEffect, useState } from "react";
import { Power, Star, MapPin, Plane, Users, Luggage, Check, ShieldAlert } from "lucide-react";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useInterval } from "@/src/lib/useInterval";
import type { Ride } from "@/src/lib/types";
import { Button, Card, Badge, Avatar, Spinner } from "@/src/components/ui";
import MapView from "@/src/components/MapView";
import ChatPanel from "@/src/components/ChatPanel";
import { money } from "@/src/lib/utils";

function RequestCard({ r, onBid, busy }: { r: any; onBid: (id: string, fare: number) => void; busy: boolean }) {
  const [fare, setFare] = useState<number>(r.recommended_fare);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={r.customer_name} size={38} />
          <div>
            <p className="text-sm font-bold">{r.customer_name}</p>
            <p className="flex items-center gap-1 text-xs text-ink-muted"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {r.customer_rating}</p>
          </div>
        </div>
        <Badge tone="brand">{r.required_class_label}</Badge>
      </div>
      <div className="space-y-1.5 rounded-xl bg-surface-alt p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">{r.pickup.airport ? <Plane className="h-4 w-4 text-brand-primary" /> : <MapPin className="h-4 w-4 text-brand-primary" />} {r.pickup.label}</p>
        <p className="flex items-center gap-2 font-semibold">{r.destination.airport ? <Plane className="h-4 w-4 text-ink" /> : <MapPin className="h-4 w-4 text-ink" />} {r.destination.label}</p>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
        <span>{r.distance_miles} mi</span><span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.passengers}</span>
        <span className="flex items-center gap-1"><Luggage className="h-3 w-3" /> {r.bags}</span>
        <span>~{r.pickup_eta_min} min away</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-line p-2">
        <button onClick={() => setFare((f) => Math.max(r.fare_min, +(f - 0.5).toFixed(2)))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-alt text-lg font-bold">−</button>
        <div className="text-center">
          <p className="font-mono text-xl font-bold">{money(fare)}</p>
          <p className="text-[11px] text-ink-muted">Range {money(r.fare_min)}–{money(r.fare_max)}</p>
        </div>
        <button onClick={() => setFare((f) => Math.min(r.fare_max, +(f + 0.5).toFixed(2)))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-alt text-lg font-bold">+</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="light" size="sm" loading={busy} onClick={() => onBid(r.id, r.recommended_fare)}>Accept {money(r.recommended_fare)}</Button>
        <Button size="sm" loading={busy} onClick={() => onBid(r.id, fare)}>Offer {money(fare)}</Button>
      </div>
    </Card>
  );
}

export default function DriverHome() {
  const { user, refresh } = useAuth();
  const [online, setOnline] = useState(false);
  const [approval, setApproval] = useState("approved");
  const [ride, setRide] = useState<Ride | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);

  const loadActive = useCallback(async () => {
    try {
      const d = await api<{ ride: Ride | null; online: boolean; approval_status: string }>("/driver/active");
      setRide(d.ride); setOnline(d.online); setApproval(d.approval_status);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async () => {
    try { const { requests } = await api<{ requests: any[] }>("/driver/requests"); setRequests(requests); }
    catch { /* ignore */ }
  }, []);

  useEffect(() => { loadActive(); }, [loadActive]);
  useInterval(loadActive, 3000);
  useInterval(() => { if (online && !ride) loadRequests(); }, 3000);
  useEffect(() => { if (online && !ride) loadRequests(); }, [online, ride, loadRequests]);

  async function toggleOnline() {
    setErr(""); setBusy(true);
    try {
      const next = online ? "offline" : "online";
      await api("/driver/online", { method: "POST", body: { status: next } });
      setOnline(!online);
      if (next === "online") loadRequests();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function bid(rideId: string, fare: number) {
    setBusy(true); setErr("");
    try { await api(`/rides/${rideId}/bid`, { method: "POST", body: { fare } }); await loadActive(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function advance(status: string) {
    setBusy(true); setErr("");
    try {
      await api(`/rides/${ride!.id}/driver-status`, { method: "POST", body: { status, pin: status === "in_progress" ? pin : undefined } });
      setPin("");
      await loadActive();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  // Approval gate
  if (approval !== "approved") {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100"><ShieldAlert className="h-7 w-7 text-warning" /></div>
          <h1 className="text-xl font-bold">{approval === "pending" ? "Application under review" : "Account not active"}</h1>
          <p className="mt-2 text-ink-muted">
            {approval === "pending"
              ? "Thanks for applying! We're reviewing your documents. You'll be able to go online as soon as you're approved."
              : "Your driver account isn't active. Please contact Getaride support."}
          </p>
        </Card>
      </div>
    );
  }

  const st = ride?.status;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        {/* Online toggle */}
        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="text-lg font-bold">{online ? "You're online" : "You're offline"}</p>
            <p className="text-sm text-ink-muted">{online ? "Receiving nearby airport requests" : "Go online to start earning"}</p>
          </div>
          <button
            onClick={toggleOnline}
            disabled={busy || !!ride}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${online ? "bg-success" : "bg-ink-muted"} disabled:opacity-50`}
          >
            <Power className="h-6 w-6 text-white" />
          </button>
        </Card>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}

        {/* Active trip control */}
        {ride ? (
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Current trip</h2>
              <Badge tone="brand">{(st || "").replace(/_/g, " ")}</Badge>
            </div>
            <div className="space-y-1.5 rounded-xl bg-surface-alt p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">{ride.pickup.airport ? <Plane className="h-4 w-4 text-brand-primary" /> : <MapPin className="h-4 w-4 text-brand-primary" />} {ride.pickup.label}</p>
              <p className="flex items-center gap-2 font-semibold">{ride.destination.airport ? <Plane className="h-4 w-4 text-ink" /> : <MapPin className="h-4 w-4 text-ink" />} {ride.destination.label}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{ride.customer_name} · {ride.distance_miles} mi</span>
              <span className="font-mono text-lg font-bold">{money(ride.final_fare || ride.recommended_fare)}</span>
            </div>

            {st === "searching" && (
              <div className="flex items-center gap-2 rounded-xl bg-brand-tertiary/50 p-3 text-sm text-brand-onTertiary">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                Offer sent — waiting for the rider to accept…
              </div>
            )}
            {st === "accepted" && <Button className="w-full" loading={busy} onClick={() => advance("arrived")}>I&apos;ve arrived at pickup</Button>}
            {st === "arrived" && (
              <div className="space-y-2">
                <p className="text-sm text-ink-muted">Ask the rider for their 4-digit start PIN.</p>
                <p className="text-center text-xs text-ink-muted">Rider PIN (demo): <span className="font-mono font-bold text-ink">{ride.start_pin}</span></p>
                <div className="flex gap-2">
                  <input value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} placeholder="PIN" className="h-11 flex-1 rounded-xl border border-line px-4 text-center font-mono text-lg tracking-widest outline-none focus:border-brand-primary" />
                  <Button loading={busy} onClick={() => advance("in_progress")}>Start trip</Button>
                </div>
              </div>
            )}
            {st === "in_progress" && <Button className="w-full" loading={busy} onClick={() => advance("completed")}>Complete trip</Button>}
            {st === "completed" && (
              <div className="rounded-xl bg-green-50 p-4 text-center">
                <Check className="mx-auto mb-1 h-6 w-6 text-success" />
                <p className="font-bold">Trip completed!</p>
                <p className="text-sm text-ink-muted">Earned {money((ride.final_fare || 0) + (ride.tip || 0))}{ride.tip ? ` (incl. ${money(ride.tip)} tip)` : ""}</p>
                <Button className="mt-3" size="sm" onClick={loadActive}>Back to requests</Button>
              </div>
            )}
          </Card>
        ) : online ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Nearby requests</h2>
            {requests.length === 0 && (
              <Card className="flex flex-col items-center gap-2 p-8 text-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                <p className="text-sm text-ink-muted">Looking for airport requests near you…</p>
              </Card>
            )}
            {requests.map((r) => <RequestCard key={r.id} r={r} onBid={bid} busy={busy} />)}
          </div>
        ) : (
          <Card className="p-8 text-center text-ink-muted">You&apos;re offline. Flip the switch to see requests.</Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden p-0">
          <MapView pickup={ride?.pickup} destination={ride?.destination} height={ride ? 380 : 300} />
        </Card>
        {ride && ["accepted", "arrived", "in_progress"].includes(st!) && (
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold">Chat with rider</h2>
            <ChatPanel rideId={ride.id} meRole="driver" />
          </Card>
        )}
      </div>
    </div>
  );
}
