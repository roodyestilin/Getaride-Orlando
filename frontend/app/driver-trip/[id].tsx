import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";

import MapView from "@/src/components/MapView";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { api } from "@/src/api";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const NEXT: Record<string, { label: string; status: string }> = {
  accepted: { label: "I've Arrived", status: "arrived" },
  arrived: { label: "Start Trip", status: "in_progress" },
  in_progress: { label: "Complete Trip", status: "completed" },
};

const STATUS_TEXT: Record<string, string> = {
  accepted: "Head to pickup",
  arrived: "Waiting for rider",
  in_progress: "Trip in progress",
};

function maneuverIcon(type?: string, modifier?: string): any {
  if (type === "arrive") return "flag";
  if (type === "depart") return "navigate";
  if (modifier?.includes("left")) return "arrow-back";
  if (modifier?.includes("right")) return "arrow-forward";
  if (modifier === "uturn") return "return-down-back";
  return "arrow-up";
}

export default function DriverTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [ride, setRide] = useState<any>(null);
  const [done, setDone] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [navInfo, setNavInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [navStep, setNavStep] = useState<{ instruction: string; distanceText: string; type?: string; modifier?: string } | null>(null);
  const doneRef = useRef(false);

  const poll = useCallback(async () => {
    if (doneRef.current) return;
    try {
      const a: any = await api("/driver/active");
      setRide(a.ride);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [poll]);

  const advance = async () => {
    const step = NEXT[ride.status];
    if (!step) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const r: any = await api(`/rides/${id}/driver-status`, { method: "POST", body: { status: step.status } });
      if (step.status === "completed") {
        doneRef.current = true;
        setDone(r.ride);
      } else {
        setRide(r.ride);
      }
    } catch {}
    setBusy(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>;
  }

  if (done) {
    return (
      <View style={[styles.center, { paddingHorizontal: spacing.xl }]}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.doneTitle}>Trip completed</Text>
        <Text style={styles.doneFare}>+${(done.final_fare ?? done.recommended_fare).toFixed(2)}</Text>
        <Text style={styles.doneSub}>{done.pickup.label} → {done.destination.label}</Text>
        <Button title="Back to Driving" onPress={() => router.replace("/(driver)")} testID="back-driving" style={{ marginTop: spacing.xl, alignSelf: "stretch" }} />
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={[styles.center, { paddingHorizontal: spacing.xl }]}>
        <Ionicons name="car-outline" size={56} color={colors.surfaceTertiary} />
        <Text style={styles.doneTitle}>No active trip</Text>
        <Button title="Back to Driving" onPress={() => router.replace("/(driver)")} testID="back-driving-2" style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
      </View>
    );
  }

  const waiting = ride.status === "searching";
  const step = NEXT[ride.status];
  const navActive = ride.status === "accepted" || ride.status === "in_progress";
  const navFrom = ride.status === "in_progress" ? ride.pickup : ride.assigned_driver?.start;
  const navTo = ride.status === "in_progress" ? ride.destination : ride.pickup;

  return (
    <View style={styles.container}>
      {navActive ? (
        <MapView
          navFrom={navFrom}
          navTo={navTo}
          onRouteInfo={setNavInfo}
          onNavStep={setNavStep}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <MapView pickup={ride.pickup} destination={ride.destination} style={StyleSheet.absoluteFill} />
      )}

      {navActive && navStep ? (
        <View style={[styles.navBanner, { top: insets.top + 60 }]} testID="nav-banner">
          <View style={styles.navManeuver}>
            <Ionicons name={maneuverIcon(navStep.type, navStep.modifier)} size={26} color="#fff" />
            {navStep.distanceText ? <Text style={styles.navDist}>{navStep.distanceText}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navInstruction} numberOfLines={2}>{navStep.instruction}</Text>
            {navInfo ? (
              <Text style={styles.navMeta}>
                {ride.status === "in_progress" ? "To destination" : "To pickup"} · {navInfo.distanceText} · {navInfo.durationText}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable testID="dt-back" onPress={() => router.replace("/(driver)")} style={[styles.backBtn, { top: insets.top + spacing.sm }]}>
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
      </Pressable>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />

        {waiting ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.waitTitle}>Bid submitted</Text>
            <Text style={styles.waitSub}>Waiting for {ride.customer_name} to accept your ${ (ride.final_fare ?? 0).toFixed(2)} fare…</Text>
          </View>
        ) : (
          <>
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>{STATUS_TEXT[ride.status] || ride.status}</Text>
              <Text style={styles.fare}>${(ride.final_fare ?? ride.recommended_fare).toFixed(2)}</Text>
            </View>

            <View style={styles.riderRow}>
              <Avatar size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>{ride.customer_name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text style={styles.metaText}>{ride.customer_rating}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{ride.distance_miles} mi</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{ride.duration_min} min trip</Text>
                </View>
              </View>
              <View style={styles.iconActions}>
                <Pressable testID="dt-chat" onPress={() => router.push(`/chat/${id}`)} style={styles.smallIcon}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={colors.brandPrimary} />
                </Pressable>
                <Pressable testID="dt-call" onPress={() => Linking.openURL("tel:+14070000000")} style={styles.smallIcon}>
                  <Ionicons name="call" size={20} color={colors.brandPrimary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.routeBox}>
              <View style={styles.routeCol}>
                <Ionicons name="ellipse" size={9} color={colors.success} />
                <View style={styles.routeLine} />
                <Ionicons name="location" size={12} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, gap: spacing.md }}>
                <Text style={styles.routeText} numberOfLines={1}>{ride.pickup.label}</Text>
                <Text style={styles.routeText} numberOfLines={1}>{ride.destination.label}</Text>
              </View>
            </View>

            {step && <Button title={step.label} onPress={advance} loading={busy} testID="advance-status" />}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef1f4" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", gap: spacing.sm },
  backBtn: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow, zIndex: 5 },
  navBanner: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#1d4ed8", borderRadius: radius.md, padding: spacing.md, ...shadow, zIndex: 6 },
  navManeuver: { alignItems: "center", minWidth: 50 },
  navDist: { fontFamily: font.monoBold, fontSize: 12, color: "#fff", marginTop: 2 },
  navInstruction: { fontFamily: font.bold, fontSize: 16, color: "#fff" },
  navMeta: { fontFamily: font.regular, fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.md, ...shadow },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.md },
  waiting: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  waitTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  waitSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  statusBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  statusText: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  fare: { fontFamily: font.monoBold, fontSize: 22, color: colors.onSurface },
  riderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  riderName: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontFamily: font.mono, fontSize: 12, color: colors.onSurfaceSecondary },
  metaDot: { color: colors.muted, marginHorizontal: 2 },
  iconActions: { flexDirection: "row", gap: spacing.sm },
  smallIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  routeBox: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.md },
  routeCol: { alignItems: "center", paddingTop: 2 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  routeText: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  doneTitle: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface, marginTop: spacing.sm },
  doneFare: { fontFamily: font.monoBold, fontSize: 32, color: colors.success },
  doneSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
});
