import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, TextInput, Modal, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import MapView, { LatLng } from "@/src/components/MapView";
import PlacePicker from "@/src/components/PlacePicker";
import SelectField from "@/src/components/SelectField";
import Button from "@/src/components/Button";
import Logo from "@/src/components/Logo";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { storage } from "@/src/utils/storage";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const DEFAULT_PICKUP: LatLng = { lat: 28.5439, lng: -81.3729, label: "Lake Eola Park" };
const PENDING_RIDE_KEY = "pendingRide";

const SCHEDULE_MAX_DAYS = 7;

function fmtScheduleLabel(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const day = sameDay ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

const AIRLINES = [
  "American Airlines", "Delta Air Lines", "United Airlines", "Southwest Airlines",
  "JetBlue", "Spirit Airlines", "Frontier Airlines", "Alaska Airlines",
  "Allegiant Air", "Sun Country", "Breeze Airways", "Air Canada",
  "British Airways", "Lufthansa", "Other",
];

export default function CustomerHome() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { user } = useAuth();
  const [pickup, setPickup] = useState<LatLng>(DEFAULT_PICKUP);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [stops, setStops] = useState<LatLng[]>([]);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [picker, setPicker] = useState<null | "pickup" | "destination" | "stop">(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needCard, setNeedCard] = useState(false);
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [bags, setBags] = useState(1);
  const [terminal, setTerminal] = useState("");
  const [baggageClaim, setBaggageClaim] = useState("");
  const [airportModal, setAirportModal] = useState(false);
  const [airportStep, setAirportStep] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user) {
        api("/payments/method")
          .then((m: any) => { if (active) setNeedCard(!!m.enabled && !m.has_card); })
          .catch(() => {});
      } else {
        setNeedCard(false);
      }
      return () => { active = false; };
    }, [user])
  );

  // Restore a ride selection saved before the guest was sent to log in.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const raw = await storage.getItem(PENDING_RIDE_KEY, "");
      if (!raw || !active) return;
      await storage.removeItem(PENDING_RIDE_KEY);
      try {
        const p = JSON.parse(raw as string);
        if (p.pickup) setPickup(p.pickup);
        if (p.destination) setDestination(p.destination);
        if (Array.isArray(p.stops)) setStops(p.stops);
        if (p.mode) setMode(p.mode);
        if (p.scheduledAt) setScheduledAt(new Date(p.scheduledAt));
        if (p.airline) setAirline(p.airline);
        if (p.flightNumber) setFlightNumber(p.flightNumber);
        if (typeof p.bags === "number") setBags(p.bags);
        if (p.terminal) setTerminal(p.terminal);
        if (p.baggageClaim) setBaggageClaim(p.baggageClaim);
      } catch {}
    })();
    return () => { active = false; };
  }, [user]);

  const onSelectPlace = (p: LatLng) => {
    setError(null);
    if (picker === "pickup") setPickup(p);
    else if (picker === "destination") setDestination(p);
    else if (picker === "stop") setStops((s) => [...s, p]);
  };

  // Flip the trip direction (to-airport ⇄ from-airport).
  const swapDirection = () => {
    if (!destination) return;
    Haptics.selectionAsync().catch(() => {});
    setPickup(destination);
    setDestination(pickup);
  };

  const reverseGeocode = async (lng: number, lat: number): Promise<string> => {
    try {
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`);
      const j = await r.json();
      return j?.features?.[0]?.place_name || "Current location";
    } catch {
      return "Current location";
    }
  };

  // Auto-detect the customer's current location on first load.
  // Try precise GPS first; if unavailable (e.g. blocked inside an iframe/preview),
  // fall back to IP-based geolocation so the pin still lands near the real location.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let resolved = false;

    const applyCoords = async (lat: number, lng: number) => {
      if (resolved) return;
      resolved = true;
      // Operating area: ignore auto-detected pickups outside ~100 miles of Orlando.
      {
        const toR = Math.PI / 180;
        const dLat = (lat - 28.5384) * toR;
        const dLng = (lng + 81.3789) * toR;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * toR) * Math.cos(28.5384 * toR) * Math.sin(dLng / 2) ** 2;
        if (3958.8 * 2 * Math.asin(Math.sqrt(a)) > 100) { resolved = true; return; }
      }
      setPickup({ lat, lng, label: "Locating…" });
      const label = await reverseGeocode(lng, lat);
      setPickup({ lat, lng, label });
    };

    const ipFallback = async () => {
      if (resolved) return;
      try {
        const r = await fetch("https://ipapi.co/json/");
        const j = await r.json();
        if (typeof j.latitude === "number" && typeof j.longitude === "number") {
          await applyCoords(j.latitude, j.longitude);
        }
      } catch {
        // keep the default Orlando pickup
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => applyCoords(pos.coords.latitude, pos.coords.longitude),
        () => ipFallback(),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      // Refine to a precise live fix as GPS sharpens (esp. on mobile).
      const wid = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.accuracy && pos.coords.accuracy <= 50) {
            applyCoords(pos.coords.latitude, pos.coords.longitude);
            navigator.geolocation.clearWatch(wid);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      setTimeout(() => { try { navigator.geolocation.clearWatch(wid); } catch {} }, 20000);
      // Safety net: some embedded browsers never invoke either callback.
      setTimeout(ipFallback, 11000);
    } else {
      ipFallback();
    }
  }, []);

  const onPickupChange = async (p: LatLng) => {
    // The airport end is fixed — ignore drags when pickup is MCO.
    if (isMCO(pickup)) return;
    setPickup({ lat: p.lat, lng: p.lng, label: pickup.label });
    const label = await reverseGeocode(p.lng, p.lat);
    setPickup({ lat: p.lat, lng: p.lng, label });
  };

  const isMCO = (p?: LatLng | null) => {
    if (!p) return false;
    const toR = Math.PI / 180;
    const dLat = (p.lat - 28.4312) * toR;
    const dLng = (p.lng + 81.3081) * toR;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * toR) * Math.cos(28.4312 * toR) * Math.sin(dLng / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.sqrt(a)) < 2; // within ~2 miles of MCO
  };

  const fromAirport = isMCO(pickup);
  const toAirport = isMCO(destination);
  const isAirportTrip = fromAirport || toAirport;
  const airportReady =
    isAirportTrip &&
    !!airline &&
    !!terminal &&
    (!fromAirport || (flightNumber.trim().length >= 2 && baggageClaim.trim().length >= 1));

  const findRides = async () => {
    if (!destination) return;
    if (!isAirportTrip) {
      setError("One end of your trip must be Orlando International Airport (MCO).");
      return;
    }
    if (isAirportTrip && !airportReady) {
      setError(fromAirport
        ? "Please add your arrival flight, airline and bag count."
        : "Please add your airline and bag count.");
      return;
    }
    if (mode === "scheduled") {
      if (!scheduledAt) { setError("Please choose a date and time for your scheduled ride."); return; }
      const now = Date.now();
      if (scheduledAt.getTime() < now - 60 * 1000) { setError("Scheduled time must be in the future."); return; }
      if (scheduledAt.getTime() > now + SCHEDULE_MAX_DAYS * 24 * 3600 * 1000) { setError("Rides can be scheduled up to 7 days in advance."); return; }
    }
    // Guests: save the selection and send them to log in / sign up first.
    if (!user) {
      await storage.setItem(PENDING_RIDE_KEY, JSON.stringify({
        pickup, destination, stops, mode, scheduledAt: scheduledAt?.toISOString() || null, airline, flightNumber, bags, terminal, baggageClaim,
      }));
      router.push("/auth");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const res: any = await api("/rides", {
        method: "POST",
        body: {
          pickup,
          destination,
          stops,
          when: mode,
          scheduled_time: mode === "scheduled" && scheduledAt ? scheduledAt.toISOString() : null,
          airport_info: {
            direction: fromAirport ? "from" : "to",
            airline,
            bags,
            flight_number: fromAirport ? flightNumber.trim() : null,
            terminal: terminal || null,
            baggage_claim: fromAirport ? baggageClaim.trim() : null,
          },
        },
      });
      if (res.ride.status === "scheduled") {
        // Scheduled: pick a driver on the offers screen first; it moves to Activity after selection.
        router.push(`/ride/${res.ride.id}`);
      } else {
        router.push(`/ride/${res.ride.id}`);
      }
    } catch (e: any) {
      setError(e?.message || "Could not request this ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView pickup={pickup} destination={destination} stops={stops} onPickupChange={onPickupChange} bottomInset={winH * 0.5} autoFit ambientCars style={StyleSheet.absoluteFill} />

      <BlurView intensity={40} tint="light" style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="home-profile" onPress={() => router.push("/(customer)/account")} style={styles.profileBtn}>
          <Ionicons name="person" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Logo size={30} showWord showMark={false} />
        <View style={{ width: 40 }} />
      </BlurView>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
        >
        <Text style={styles.sheetTitle}>Where to?</Text>

        <View style={styles.modeRow}>
          <ModePill label="Ride Now" icon="flash" active={mode === "now"} onPress={() => setMode("now")} testID="mode-now" />
          <ModePill label="Schedule" icon="calendar" active={mode === "scheduled"} onPress={() => setScheduleModal(true)} testID="mode-schedule" />
        </View>

        {mode === "scheduled" && scheduledAt && (
          <Pressable testID="schedule-summary" onPress={() => setScheduleModal(true)} style={styles.scheduleChip}>
            <Ionicons name="calendar" size={16} color={colors.brandPrimary} />
            <Text style={styles.scheduleChipText}>Pickup {fmtScheduleLabel(scheduledAt)}</Text>
            <Ionicons name="pencil" size={14} color={colors.muted} />
          </Pressable>
        )}

        <View style={styles.inputCard}>
          {isMCO(pickup) ? (
            <View style={styles.locRow} testID="pickup-row">
              <Ionicons name="airplane" size={14} color={colors.brandPrimary} />
              <Text style={styles.locText} numberOfLines={1}>Orlando International Airport (MCO)</Text>
              <Ionicons name="lock-closed" size={13} color={colors.muted} />
            </View>
          ) : (
            <LocationRow
              icon="ellipse"
              iconColor={colors.success}
              label={pickup.label || "Pickup location"}
              onPress={() => setPicker("pickup")}
              testID="pickup-row"
            />
          )}
          {stops.map((s, i) => (
            <View key={i}>
              <View style={styles.divider} />
              <LocationRow
                icon="ellipse"
                iconColor={colors.warning}
                label={s.label || "Stop"}
                onPress={() => setStops((arr) => arr.filter((_, idx) => idx !== i))}
                trailing="close"
                testID={`stop-row-${i}`}
              />
            </View>
          ))}
          <View style={styles.divider} />
          {isMCO(destination) ? (
            <View style={styles.locRow} testID="destination-row">
              <Ionicons name="airplane" size={14} color={colors.brandPrimary} />
              <Text style={styles.locText} numberOfLines={1}>Orlando International Airport (MCO)</Text>
              <Ionicons name="lock-closed" size={13} color={colors.muted} />
            </View>
          ) : (
            <LocationRow
              icon="location"
              iconColor={colors.brandPrimary}
              label={destination?.label || "Where are you going?"}
              placeholder={!destination}
              onPress={() => setPicker("destination")}
              testID="destination-row"
            />
          )}
          <Pressable testID="swap-direction" onPress={swapDirection} style={styles.swapBtn} hitSlop={8}>
            <Ionicons name="swap-vertical" size={18} color={colors.brandPrimary} />
          </Pressable>
        </View>

        {!isMCO(pickup) ? (
          <View style={styles.pinHint}>
            <Ionicons name="hand-left-outline" size={13} color={colors.muted} />
            <Text style={styles.pinHintText}>Drag the green pin on the map to set your exact pickup</Text>
          </View>
        ) : null}


        <Pressable testID="add-stop" onPress={() => setPicker("stop")} style={styles.addStop}>
          <Ionicons name="add-circle-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.addStopText}>Add stop</Text>
        </Pressable>

        {isAirportTrip ? (
          <Pressable
            testID="airport-card"
            onPress={() => { setAirportStep(0); setAirportModal(true); }}
            style={styles.airportSummary}
          >
            <Ionicons name="airplane" size={18} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.airportSummaryTitle}>{fromAirport ? "Airport pickup details" : "Airport drop-off details"}</Text>
              <Text style={styles.airportSummarySub}>
                {airportReady
                  ? `${airline}${flightNumber ? ` · ${flightNumber}` : ""}${terminal ? ` · Term ${terminal}` : ""}${fromAirport && baggageClaim ? ` · Claim ${baggageClaim}` : ""} · ${bags} bag${bags === 1 ? "" : "s"}`
                  : "Tap to add flight & bag details"}
              </Text>
            </View>
            <Ionicons name={airportReady ? "checkmark-circle" : "chevron-forward"} size={20} color={airportReady ? colors.success : colors.muted} />
          </Pressable>
        ) : null}

        {needCard ? (
          <Pressable testID="add-card-banner" onPress={() => router.push("/payment-methods")} style={styles.cardBanner}>
            <Ionicons name="card-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.cardBannerText}>Add a payment method for faster checkout</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.brandPrimary} />
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.errorBox} testID="ride-error">
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          title={
            isAirportTrip && !airportReady ? "Add airport details"
              : mode === "now" ? "Find Rides" : "Schedule Ride"
          }
          onPress={
            isAirportTrip && !airportReady ? () => { setAirportStep(0); setAirportModal(true); }
              : findRides
          }
          disabled={!destination}
          loading={loading}
          testID="find-rides"
        />
        </ScrollView>
      </View>

      <AirportDetailsModal
        visible={airportModal}
        fromAirport={fromAirport}
        step={airportStep}
        setStep={setAirportStep}
        airline={airline}
        setAirline={setAirline}
        flightNumber={flightNumber}
        setFlightNumber={setFlightNumber}
        bags={bags}
        setBags={setBags}
        terminal={terminal}
        setTerminal={setTerminal}
        baggageClaim={baggageClaim}
        setBaggageClaim={setBaggageClaim}
        onClose={() => setAirportModal(false)}
        onSubmit={() => { setAirportModal(false); findRides(); }}
        insets={insets}
      />

      <ScheduleModal
        visible={scheduleModal}
        initial={scheduledAt}
        onCancel={() => {
          setScheduleModal(false);
          if (!scheduledAt) setMode("now");
        }}
        onConfirm={(d: Date) => {
          setScheduledAt(d);
          setMode("scheduled");
          setScheduleModal(false);
          setError(null);
        }}
        insets={insets}
      />

      <PlacePicker
        visible={picker !== null}
        title={picker === "pickup" ? "Set pickup" : picker === "stop" ? "Add a stop" : "Set destination"}
        onlyMCO={
          picker === "destination" ? !isMCO(pickup)
            : picker === "pickup" ? (!!destination && !isMCO(destination))
            : false
        }
        onClose={() => setPicker(null)}
        onSelect={onSelectPlace}
      />
    </View>
  );
}

function ScheduleModal({ visible, initial, onCancel, onConfirm, insets }: any) {
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const days: Date[] = Array.from({ length: SCHEDULE_MAX_DAYS + 1 }, (_, i) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + i);
    return d;
  });

  const roundedNext = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    const m = d.getMinutes();
    d.setMinutes(m - (m % 15), 0, 0);
    return d;
  };

  const [dayIdx, setDayIdx] = useState(0);
  const [minutes, setMinutes] = useState(() => { const r = roundedNext(); return r.getHours() * 60 + r.getMinutes(); });

  useEffect(() => {
    if (!visible) return;
    const base = initial ? new Date(initial) : roundedNext();
    const di = days.findIndex((d) => d.toDateString() === startOfDay(base).toDateString());
    setDayIdx(di >= 0 ? di : 0);
    setMinutes(base.getHours() * 60 + base.getMinutes());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isToday = dayIdx === 0;
  const minToday = (() => { const r = roundedNext(); return r.getHours() * 60 + r.getMinutes(); })();
  const slots = Array.from({ length: 96 }, (_, i) => i * 15).filter((m) => !isToday || m >= minToday);

  const chosen = (() => { const d = new Date(days[dayIdx]); d.setMinutes(minutes); return d; })();
  const valid = slots.includes(minutes) || slots.length === 0 ? slots.includes(minutes) : false;
  const fmtTime = (m: number) => {
    const h = Math.floor(m / 60); const mm = m % 60;
    const ap = h < 12 ? "AM" : "PM"; const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mm.toString().padStart(2, "0")} ${ap}`;
  };
  const dayLabel = (d: Date, i: number) => {
    if (i === 0) return "Today";
    if (i === 1) return "Tomorrow";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.schedBackdrop}>
        <View style={[styles.schedSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <View style={styles.schedHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.schedTitle}>Schedule your ride</Text>
              <Text style={styles.schedSub}>Book a pickup up to 7 days in advance.</Text>
            </View>
            <Pressable testID="schedule-close" onPress={onCancel} hitSlop={10} style={styles.schedClose}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>

          <Text style={styles.schedLabel}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {days.map((d, i) => {
              const active = i === dayIdx;
              return (
                <Pressable key={i} testID={`sched-day-${i}`} onPress={() => setDayIdx(i)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{dayLabel(d, i)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.schedLabel, { marginTop: spacing.md }]}>Pickup time</Text>
          <ScrollView style={styles.timeList} contentContainerStyle={{ paddingVertical: spacing.xs }} showsVerticalScrollIndicator={false}>
            {slots.map((m) => {
              const active = m === minutes;
              return (
                <Pressable key={m} testID={`sched-time-${m}`} onPress={() => setMinutes(m)} style={[styles.timeRow, active && styles.timeRowActive]}>
                  <Text style={[styles.timeText, active && styles.timeTextActive]}>{fmtTime(m)}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={18} color={colors.brandPrimary} /> : null}
                </Pressable>
              );
            })}
            {slots.length === 0 ? <Text style={styles.timeEmpty}>No more slots today — pick another day.</Text> : null}
          </ScrollView>

          <Button
            title={`Set pickup · ${fmtScheduleLabel(chosen)}`}
            onPress={() => onConfirm(chosen)}
            disabled={!valid}
            testID="schedule-confirm"
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </Modal>
  );
}

function ModePill({ label, icon, active, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.modePill, active && styles.modePillActive]}>
      <Ionicons name={icon} size={16} color={active ? "#fff" : colors.muted} />
      <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LocationRow({ icon, iconColor, label, onPress, placeholder, trailing, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.locRow}>
      <Ionicons name={icon} size={14} color={iconColor} />
      <Text style={[styles.locText, placeholder && styles.locPlaceholder]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name={trailing === "close" ? "close-circle" : "chevron-forward"} size={18} color={colors.muted} />
    </Pressable>
  );
}

function AirportDetailsModal({ visible, fromAirport, step, setStep, airline, setAirline, flightNumber, setFlightNumber, bags, setBags, terminal, setTerminal, baggageClaim, setBaggageClaim, onClose, onSubmit, insets }: any) {
  const steps: string[] = fromAirport
    ? ["flight", "terminal", "baggage", "airline", "bags"]
    : ["airline", "terminal", "bags"];
  const key = steps[Math.min(step, steps.length - 1)];
  const isLast = step === steps.length - 1;
  const valid =
    key === "flight" ? flightNumber.trim().length >= 2 :
    key === "terminal" ? !!terminal :
    key === "baggage" ? baggageClaim.trim().length >= 1 :
    key === "airline" ? !!airline :
    true;

  const titles: Record<string, string> = {
    flight: "Arrival flight number",
    terminal: "Which terminal?",
    baggage: "Baggage claim number",
    airline: "Which airline?",
    bags: "How many bags?",
  };
  const subtitles: Record<string, string> = {
    flight: "We'll share this with your driver so they can track your arrival.",
    terminal: fromAirport
      ? "MCO has terminals A, B and C — pick where you'll exit."
      : "MCO has terminals A, B and C — pick your departure terminal.",
    baggage: "The carousel number so your driver knows where to meet you.",
    airline: "Helps your driver find the right terminal.",
    bags: "So your driver brings enough trunk space.",
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalWrap, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.modalHeader}>
          <Pressable testID="airport-back" onPress={() => (step > 0 ? setStep((s: number) => s - 1) : onClose())} style={styles.modalBack}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={styles.stepDots}>
            {steps.map((s, i) => (
              <View key={s} style={[styles.stepDot, i === step && styles.stepDotActive]} />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.modalBody}>
          <View style={styles.modalIcon}>
            <Ionicons name="airplane" size={26} color={colors.brandPrimary} />
          </View>
          <Text style={styles.modalTitle}>{titles[key]}</Text>
          <Text style={styles.modalSub}>{subtitles[key]}</Text>

          {key === "flight" ? (
            <TextInput
              testID="flight-input"
              style={styles.modalInput}
              placeholder="e.g. AA1234"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoFocus
              value={flightNumber}
              onChangeText={setFlightNumber}
            />
          ) : key === "terminal" ? (
            <View style={styles.terminalRow}>
              {["A", "B", "C"].map((t) => (
                <Pressable
                  key={t}
                  testID={`terminal-${t}`}
                  onPress={() => setTerminal(t)}
                  style={[styles.terminalBtn, terminal === t && styles.terminalBtnActive]}
                >
                  <Text style={[styles.terminalText, terminal === t && styles.terminalTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          ) : key === "baggage" ? (
            <TextInput
              testID="baggage-input"
              style={styles.modalInput}
              placeholder="e.g. 12"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              autoFocus
              value={baggageClaim}
              onChangeText={setBaggageClaim}
            />
          ) : key === "airline" ? (
            <View style={{ zIndex: 10 }}>
              <SelectField
                label=""
                testID="airline-select"
                value={airline}
                options={AIRLINES}
                placeholder="Select airline"
                onSelect={setAirline}
              />
            </View>
          ) : (
            <View style={styles.modalBagsRow}>
              <Pressable testID="bags-minus" onPress={() => setBags((b: number) => Math.max(0, b - 1))} style={styles.bagsBtn}>
                <Ionicons name="remove" size={22} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.modalBagsCount} testID="bags-count">{bags}</Text>
              <Pressable testID="bags-plus" onPress={() => setBags((b: number) => Math.min(20, b + 1))} style={styles.bagsBtn}>
                <Ionicons name="add" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
          )}
        </View>

        <Button
          title={isLast ? "Find Rides" : "Continue"}
          onPress={() => (isLast ? onSubmit() : setStep((s: number) => s + 1))}
          disabled={!valid}
          testID="airport-continue"
        />
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef1f4" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    overflow: "hidden",
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "60%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    ...shadow,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.sm },
  sheetTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface, marginBottom: spacing.sm },
  modeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  modePillActive: { backgroundColor: colors.brandPrimary },
  modePillText: { fontFamily: font.semibold, fontSize: 14, color: colors.muted },
  modePillTextActive: { color: "#fff" },
  chipRow: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: { flexShrink: 0, paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  chipTextActive: { color: colors.brandPrimary },
  scheduleChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.lg, height: 44, marginBottom: spacing.md },
  scheduleChipText: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.brandPrimary },
  schedBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  schedSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.md, maxHeight: "82%" },
  schedHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  schedTitle: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  schedSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  schedClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  schedLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  timeList: { maxHeight: 240, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 46 },
  timeRowActive: { backgroundColor: colors.brandTertiary },
  timeText: { fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  timeTextActive: { fontFamily: font.bold, color: colors.brandPrimary },
  timeEmpty: { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: "center", padding: spacing.lg },
  inputCard: { position: "relative", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingLeft: spacing.lg, paddingRight: spacing.lg + 44 },
  swapBtn: {
    position: "absolute",
    right: spacing.md,
    top: "50%",
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 46 },
  locText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.onSurface },
  locPlaceholder: { color: colors.muted, fontFamily: font.regular },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 26 },
  addStop: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm },
  pinHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing.xs },
  pinHintText: { fontFamily: font.regular, fontSize: 11, color: colors.muted },
  addStopText: { fontFamily: font.semibold, fontSize: 13, color: colors.brandPrimary },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.error },
  cardBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  cardBannerText: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.brandPrimary },
  airportSummary: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  airportSummaryTitle: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface },
  airportSummarySub: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing["2xl"] },
  modalBack: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  stepDots: { flexDirection: "row", gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary },
  stepDotActive: { backgroundColor: colors.brandPrimary, width: 22 },
  modalBody: { flex: 1 },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  modalTitle: { fontFamily: font.bold, fontSize: 24, color: colors.onSurface, marginBottom: spacing.sm },
  modalSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, marginBottom: spacing.xl, lineHeight: 20 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 56, fontFamily: font.semibold, fontSize: 18, color: colors.onSurface, backgroundColor: colors.surface },
  modalBagsRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  modalBagsCount: { fontFamily: font.bold, fontSize: 28, color: colors.onSurface, minWidth: 40, textAlign: "center" },
  terminalRow: { flexDirection: "row", gap: spacing.md },
  terminalBtn: { flex: 1, height: 72, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  terminalBtnActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  terminalText: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface },
  terminalTextActive: { color: colors.brandPrimary },
  airportCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  airportHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  airportTitle: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface },
  airportLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginBottom: 6 },
  airportInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 46, fontFamily: font.regular, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface },
  bagsRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  bagsBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  bagsCount: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface, minWidth: 28, textAlign: "center" },
});
