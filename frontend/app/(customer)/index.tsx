import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import MapView, { LatLng } from "@/src/components/MapView";
import PlacePicker from "@/src/components/PlacePicker";
import Button from "@/src/components/Button";
import Logo from "@/src/components/Logo";
import { api } from "@/src/api";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const DEFAULT_PICKUP: LatLng = { lat: 28.5439, lng: -81.3729, label: "Lake Eola Park" };

const SCHEDULE_OPTIONS = ["In 30 min", "In 1 hour", "In 2 hours", "Tonight"];

export default function CustomerHome() {
  const insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState<LatLng>(DEFAULT_PICKUP);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [stops, setStops] = useState<LatLng[]>([]);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [schedule, setSchedule] = useState(SCHEDULE_OPTIONS[0]);
  const [picker, setPicker] = useState<null | "pickup" | "destination" | "stop">(null);
  const [loading, setLoading] = useState(false);

  const onSelectPlace = (p: LatLng) => {
    if (picker === "pickup") setPickup(p);
    else if (picker === "destination") setDestination(p);
    else if (picker === "stop") setStops((s) => [...s, p]);
  };

  const onPickupChange = async (p: LatLng) => {
    setPickup({ lat: p.lat, lng: p.lng, label: pickup.label });
    try {
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${p.lng},${p.lat}.json?access_token=${token}&limit=1`);
      const j = await r.json();
      const label = j?.features?.[0]?.place_name || "Custom pickup location";
      setPickup({ lat: p.lat, lng: p.lng, label });
    } catch {
      setPickup({ lat: p.lat, lng: p.lng, label: "Custom pickup location" });
    }
  };

  const findRides = async () => {
    if (!destination) return;
    setLoading(true);
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
        },
      });
      router.push(`/ride/${res.ride.id}`);
    } catch {
      // surfaced via no-op; keep simple
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView pickup={pickup} destination={destination} stops={stops} onPickupChange={onPickupChange} autoFit={!!destination} style={StyleSheet.absoluteFill} />

      <BlurView intensity={40} tint="light" style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="home-profile" onPress={() => router.push("/(customer)/account")} style={styles.profileBtn}>
          <Ionicons name="person" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Logo size={30} showWord showMark={false} />
        <View style={{ width: 40 }} />
      </BlurView>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
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

        <Button
          title={mode === "now" ? "Find Rides" : "Schedule Ride"}
          onPress={findRides}
          disabled={!destination}
          loading={loading}
          testID="find-rides"
        />
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    ...shadow,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.md },
  sheetTitle: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface, marginBottom: spacing.md },
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
});
