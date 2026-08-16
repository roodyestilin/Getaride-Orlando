"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Star, MapPin, Plane, ShieldCheck, X, Check } from "lucide-react";
import { api } from "@/src/lib/api";
import { useInterval } from "@/src/lib/useInterval";
import type { Offer, Ride } from "@/src/lib/types";
import { Button, Card, Badge, Avatar, FullSpinner } from "@/src/components/ui";
import MapView from "@/src/components/MapView";
import ChatPanel from "@/src/components/ChatPanel";
import { money } from "@/src/lib/utils";

const LIVE = ["driver_enroute", "arrived", "in_progress"];
const STATUS_LABEL: Record<string, string> = {
  searching: "Finding drivers",
  scheduled: "Scheduled",
  driver_enroute: "Driver on the way",
  arrived: "Driver has arrived",
  in_progress: "On the trip",
  completed: "Trip completed",
  cancelled: "Cancelled",
};

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [track, setTrack] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tipDone, setTipDone] = useState(false);
  const [rateStars, setRateStars] = useState(0);
  const [rated, setRated] = useState(false);

  const status = track?.status || ride?.status;

  const loadRide = useCallback(async () => {
    try {
      const { ride } = await api<{ ride: Ride }>(`/rides/${id}`);
      setRide(ride);
    } catch (e: any) { setErr(e.message); }
  }, [id]);

  const loadTrack = useCallback(async () => {
    try { setTrack(await api(`/rides/${id}/track`)); } catch { /* ignore */ }
  }, [id]);

  const loadOffers = useCallback(async () => {
    try {
      const { offers } = await api<{ offers: Offer[] }>(`/rides/${id}/offers`);
      setOffers(offers);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadRide(); loadTrack(); }, [loadRide, loadTrack]);
  useInterval(loadTrack, 2500);
  useInterval(() => { if (status === "searching" || (status === "scheduled" && !ride?.assigned_driver)) loadOffers(); }, 2000);

  async function selectOffer(offerId: string) {
    setBusy(true); setErr("");
    try {
      await api(`/rides/${id}/select`, { method: "POST", body: { offer_id: offerId } });
      await loadRide(); await loadTrack();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function cancel() {
    if (!confirm("Cancel this ride?")) return;
    setBusy(true);
    try {
      const r = await api<{ cancellation_fee: number }>(`/rides/${id}/cancel`, { method: "POST" });
      if (r.cancellation_fee) alert(`A ${money(r.cancellation_fee)} cancellation fee was applied.`);
      await loadRide(); await loadTrack();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function tip(amount: number) {
    setBusy(true);
    try { await api(`/rides/${id}/tip`, { method: "POST", body: { amount } }); setTipDone(true); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function rate(stars: number) {
    setRateStars(stars);
    try { await api(`/rides/${id}/rate`, { method: "POST", body: { rating: stars } }); setRated(true); }
    catch (e: any) { setErr(e.message); }
  }

  if (!ride) return <FullSpinner />;

  const driver = track?.assigned_driver || ride.assigned_driver;
  const driverLoc = LIVE.includes(status) ? track?.driver_location : null;
  const isSearching = status === "searching" || (status === "scheduled" && !driver);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* LEFT: map + route */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{STATUS_LABEL[status] || status}</h1>
            <Badge tone={status === "completed" ? "success" : status === "cancelled" ? "danger" : "brand"}>
              {ride.required_class_label}
            </Badge>
          </div>
          {track?.eta_minutes > 0 && LIVE.includes(status) && (
            <span className="font-mono text-lg font-bold text-brand-primary">{track.eta_minutes} min</span>
          )}
        </div>

        <Card className="overflow-hidden p-0">
          <MapView pickup={ride.pickup} destination={ride.destination} driver={driverLoc} height={380} />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tertiary">
              {ride.pickup.airport ? <Plane className="h-4 w-4 text-brand-primary" /> : <MapPin className="h-4 w-4 text-brand-primary" />}
            </div>
            <div><p className="text-xs font-semibold uppercase text-ink-muted">Pickup</p><p className="font-semibold">{ride.pickup.label}</p></div>
          </div>
          <div className="ml-4 h-4 border-l-2 border-dashed border-line" />
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink">
              {ride.destination.airport ? <Plane className="h-4 w-4 text-white" /> : <MapPin className="h-4 w-4 text-white" />}
            </div>
            <div><p className="text-xs font-semibold uppercase text-ink-muted">Drop-off</p><p className="font-semibold">{ride.destination.label}</p></div>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-ink-muted">{ride.distance_miles} mi · {ride.passengers} pax · {ride.bags} bags</span>
            <span className="font-mono text-lg font-bold">{money(ride.final_fare || ride.recommended_fare)}</span>
          </div>
        </Card>
      </div>

      {/* RIGHT: offers / driver / actions */}
      <div className="space-y-4">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}

        {isSearching && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Driver offers</h2>
              <span className="text-sm text-ink-muted">{offers.length} so far…</span>
            </div>
            {offers.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                <p className="text-sm text-ink-muted">Waiting for drivers to send offers…</p>
              </div>
            )}
            <div className="space-y-3">
              {offers.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-xl border border-line p-3 animate-fade-up">
                  <Avatar src={o.driver.photo} name={o.driver.name} size={46} />
                  <div className="flex-1">
                    <p className="font-bold">{o.driver.name}</p>
                    <p className="text-xs text-ink-muted">★ {o.driver.rating} · {o.eta_minutes} min · {o.driver.color} {o.driver.vehicle}</p>
                    <p className="text-[11px] text-ink-muted">{o.driver.class_label}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold">{money(o.fare)}</p>
                    <Button size="sm" className="mt-1" loading={busy} onClick={() => selectOffer(o.id)}>Choose</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-4 w-full text-danger" onClick={cancel}>Cancel request</Button>
          </Card>
        )}

        {driver && !isSearching && (
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar src={driver.photo} name={driver.name} size={60} />
              <div className="flex-1">
                <p className="text-lg font-bold">{driver.name}</p>
                <p className="flex items-center gap-1 text-sm text-ink-muted"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {driver.rating} · {driver.color} {driver.vehicle}</p>
                {driver.plate && <Badge tone="muted" className="mt-1">{driver.plate}</Badge>}
              </div>
            </div>

            {status === "scheduled" && (
              <div className="mt-4 rounded-xl bg-brand-tertiary/50 p-3 text-sm text-brand-onTertiary">
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                Booked for {ride.scheduled_time ? new Date(ride.scheduled_time).toLocaleString() : "your scheduled time"}. Your driver will head out near pickup time.
              </div>
            )}

            {(status === "driver_enroute" || status === "arrived") && track?.start_pin && (
              <div className="mt-4 rounded-xl border border-brand-primary/30 bg-brand-tertiary/40 p-4 text-center">
                <p className="text-xs font-semibold uppercase text-ink-muted">Share this start PIN with your driver</p>
                <p className="font-mono text-3xl font-bold tracking-[0.3em] text-brand-primary">{track.start_pin}</p>
              </div>
            )}

            {LIVE.includes(status) || status === "scheduled" ? (
              <Button variant="light" className="mt-4 w-full text-danger" loading={busy} onClick={cancel}>
                <X className="h-4 w-4" /> Cancel ride
              </Button>
            ) : null}
          </Card>
        )}

        {status === "completed" && (
          <Card className="space-y-4 p-5">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><Check className="h-7 w-7 text-success" /></div>
              <h2 className="text-lg font-bold">Trip completed</h2>
              <p className="font-mono text-2xl font-bold">{money((ride.final_fare || 0) + (ride.tip || 0))}</p>
              <p className="text-sm text-ink-muted">Fare {money(ride.final_fare)}{ride.tip ? ` + ${money(ride.tip)} tip` : ""}</p>
            </div>
            {!rated ? (
              <div>
                <p className="mb-2 text-center text-sm font-semibold">Rate your driver</p>
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map((s) => (
                    <button key={s} onClick={() => rate(s)}>
                      <Star className={`h-8 w-8 ${s <= rateStars ? "fill-amber-400 text-amber-400" : "text-line"}`} />
                    </button>
                  ))}
                </div>
              </div>
            ) : <p className="text-center text-sm font-semibold text-success">Thanks for your rating!</p>}
            {!tipDone ? (
              <div>
                <p className="mb-2 text-center text-sm font-semibold">Add a tip</p>
                <div className="grid grid-cols-4 gap-2">
                  {[3,5,8].map((a) => (
                    <Button key={a} variant="light" size="sm" loading={busy} onClick={() => tip(a)}>{money(a)}</Button>
                  ))}
                  <Button variant="light" size="sm" onClick={() => setTipDone(true)}>No tip</Button>
                </div>
              </div>
            ) : <p className="text-center text-sm font-semibold text-success">Tip added — thank you!</p>}
            <Button className="w-full" onClick={() => router.push("/rider")}>Book another ride</Button>
          </Card>
        )}

        {status === "cancelled" && (
          <Card className="p-6 text-center">
            <p className="text-lg font-bold">This ride was cancelled</p>
            {ride.cancellation_fee ? <p className="mt-1 text-sm text-danger">Cancellation fee: {money(ride.cancellation_fee)}</p> : null}
            <Button className="mt-4" onClick={() => router.push("/rider")}>Book another ride</Button>
          </Card>
        )}

        {(LIVE.includes(status) || status === "scheduled") && driver && (
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold">Chat with your driver</h2>
            <ChatPanel rideId={ride.id} meRole="customer" />
          </Card>
        )}
      </div>
    </div>
  );
}
