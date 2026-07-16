import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, TextInput } from "react-native";
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
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const DEFAULT_PICKUP: LatLng = { lat: 28.5439, lng: -81.3729, label: "Lake Eola Park" };

const SCHEDULE_OPTIONS = ["In 30 min", "In 1 hour", "In 2 hours", "Tonight"];

const AIRLINES = [
  "American Airlines", "Delta Air Lines", "United Airlines", "Southwest Airlines",
  "JetBlue", "Spirit Airlines", "Frontier Airlines", "Alaska Airlines",
  "Allegiant Air", "Sun Country", "Breeze Airways", "Air Canada",
  "British Airways", "Lufthansa", "Other",
];

export default function CustomerHome() {
  const insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState<LatLng>(DEFAULT_PICKUP);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [stops, setStops] = useState<LatLng[]>([]);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [schedule, setSchedule] = useState(SCHEDULE_OPTIONS[0]);
  const [picker, setPicker] = useState<null | "pickup" | "destination" | "stop">(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needCard, setNeedCard] = useState(false);
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [bags, setBags] = useState(1);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api("/payments/method")
        .then((m: any) => { if (active) setNeedCard(!!m.enabled && !m.has_card); })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const onSelectPlace = (p: LatLng) => {
    setError(null);
    if (picker === "pickup") setPickup(p);
    else if (picker === "destination") setDestination(p);
    else if (picker === "stop") setStops((s) => [...s, p]);
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
    setPickup({ lat: p.lat, lng: p.lng, label: pickup.label });
    const label = await reverseGeocode(p.lng, p.lat);
    setPickup({ lat: p.lat, lng: p.lng, label });
  };

  const fromAirport = !!pickup?.airport;
  const toAirport = !!destination?.airport;
  const isAirportTrip = fromAirport || toAirport;
  const airportReady =
    !isAirportTrip ||
    (!!airline && bags >= 0 && (!fromAirport || flightNumber.trim().length >= 2));

  const findRides = async () => {
    if (!destination) return;
    if (isAirportTrip && !airportReady) {
      setError(fromAirport
        ? "Please add your arrival flight, airline and bag count."
        : "Please add your airline and bag count.");
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
          scheduled_time: mode === "scheduled" ? schedule : null,
          airport_info: isAirportTrip
            ? {
                direction: fromAirport ? "from" : "to",
                airline,
                bags,
                flight_number: fromAirport ? flightNumber.trim() : null,
              }
            : null,
        },
      });
      router.push(`/ride/${res.ride.id}`);
    } catch (e: any) {
      setError(e?.message || "Could not request this ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView pickup={pickup} destination={destination} stops={stops} onPickupChange={onPickupChange} autoFit style={StyleSheet.absoluteFill} />

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
          <ModePill label="Schedule" icon="calendar" active={mode === "scheduled"} onPress={() => setMode("scheduled")} testID="mode-schedule" />
        </View>

        {mode === "scheduled" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SCHEDULE_OPTIONS.map((opt) => {
              const active = schedule === opt;
              return (
                <Pressable
                  key={opt}
                  testID={`schedule-${opt}`}
                  onPress={() => setSchedule(opt)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.inputCard}>
          <LocationRow
            icon="ellipse"
            iconColor={colors.success}
            label={pickup.label || "Pickup location"}
            onPress={() => setPicker("pickup")}
            testID="pickup-row"
          />
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
          <LocationRow
            icon="location"
            iconColor={colors.brandPrimary}
            label={destination?.label || "Where are you going?"}
            placeholder={!destination}
            onPress={() => setPicker("destination")}
            testID="destination-row"
          />
        </View>

        <View style={styles.pinHint}>
          <Ionicons name="hand-left-outline" size={13} color={colors.muted} />
          <Text style={styles.pinHintText}>Drag the green pin on the map to set your exact pickup</Text>
        </View>


        <Pressable testID="add-stop" onPress={() => setPicker("stop")} style={styles.addStop}>
          <Ionicons name="add-circle-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.addStopText}>Add stop</Text>
        </Pressable>

        {isAirportTrip ? (
          <View style={styles.airportCard} testID="airport-card">
            <View style={styles.airportHeader}>
              <Ionicons name="airplane" size={16} color={colors.brandPrimary} />
              <Text style={styles.airportTitle}>{fromAirport ? "Airport pickup details" : "Airport drop-off details"}</Text>
            </View>

            {fromAirport ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={styles.airportLabel}>Arrival flight number</Text>
                <TextInput
                  testID="flight-input"
                  style={styles.airportInput}
                  placeholder="e.g. AA1234"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  value={flightNumber}
                  onChangeText={(t) => { setFlightNumber(t); setError(null); }}
                />
              </View>
            ) : null}

            <SelectField
              label="Airline"
              testID="airline-select"
              value={airline}
              options={AIRLINES}
              placeholder="Select airline"
              onSelect={(v: string) => { setAirline(v); setError(null); }}
            />

            <Text style={[styles.airportLabel, { marginTop: spacing.md }]}>Number of bags</Text>
            <View style={styles.bagsRow}>
              <Pressable testID="bags-minus" onPress={() => setBags((b) => Math.max(0, b - 1))} style={styles.bagsBtn}>
                <Ionicons name="remove" size={20} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.bagsCount} testID="bags-count">{bags}</Text>
              <Pressable testID="bags-plus" onPress={() => setBags((b) => Math.min(20, b + 1))} style={styles.bagsBtn}>
                <Ionicons name="add" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {needCard ? (
          <Pressable testID="add-card-banner" onPress={() => router.push("/payment-methods")} style={styles.cardBanner}>
            <Ionicons name="card-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.cardBannerText}>Add a payment method to request rides</Text>
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
          title={needCard ? "Add payment method" : mode === "now" ? "Find Rides" : "Schedule Ride"}
          onPress={needCard ? () => router.push("/payment-methods") : findRides}
          disabled={!needCard && !destination}
          loading={loading}
          testID="find-rides"
        />
        </ScrollView>
      </View>

      <PlacePicker
        visible={picker !== null}
        title={picker === "pickup" ? "Set pickup" : picker === "stop" ? "Add a stop" : "Set destination"}
        onClose={() => setPicker(null)}
        onSelect={onSelectPlace}
      />
    </View>
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
  inputCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  locRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 54 },
  locText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  locPlaceholder: { color: colors.muted, fontFamily: font.regular },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 26 },
  addStop: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.md },
  pinHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing.sm },
  pinHintText: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  addStopText: { fontFamily: font.semibold, fontSize: 14, color: colors.brandPrimary },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.error },
  cardBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  cardBannerText: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.brandPrimary },
  airportCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  airportHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  airportTitle: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface },
  airportLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginBottom: 6 },
  airportInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 46, fontFamily: font.regular, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface },
  bagsRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  bagsBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  bagsCount: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface, minWidth: 28, textAlign: "center" },
});
