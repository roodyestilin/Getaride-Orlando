import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";

import MapView, { LatLng } from "@/src/components/MapView";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { api } from "@/src/api";
import { colors, font, radius, shadow, shadowSoft, spacing } from "@/src/theme";

const STATUS_TEXT: Record<string, string> = {
  driver_enroute: "Driver is on the way",
  arrived: "Your driver has arrived",
  in_progress: "Enjoy your ride",
  completed: "You've arrived!",
};

export default function RideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [track, setTrack] = useState<any>(null);
  const [status, setStatus] = useState<string>("searching");
  const [selecting, setSelecting] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    api(`/rides/${id}`).then((r: any) => {
      setRide(r.ride);
      setStatus(r.ride.status);
    });
  }, [id]);

  const tick = useCallback(async () => {
    try {
      if (statusRef.current === "searching") {
        const r: any = await api(`/rides/${id}/offers`);
        setOffers(r.offers);
      } else {
        const t: any = await api(`/rides/${id}/track`);
        setTrack(t);
        if (t.status && t.status !== statusRef.current) setStatus(t.status);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    const iv = setInterval(tick, 2000);
    tick();
    return () => clearInterval(iv);
  }, [tick, status]);

  const accept = async (offer: any) => {
    setSelecting(offer.id);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const r: any = await api(`/rides/${id}/select`, { method: "POST", body: { offer_id: offer.id } });
      setRide(r.ride);
      setStatus(r.ride.status);
    } catch {
      setSelecting(null);
    }
  };

  const cancel = async () => {
    await api(`/rides/${id}/cancel`, { method: "POST" });
    router.replace("/(customer)");
  };

  if (!ride) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const isSearching = status === "searching";
  const driverLoc: LatLng | null = track?.driver_location || ride.assigned_driver?.start || null;

  return (
    <View style={styles.container}>
      <MapView
        pickup={ride.pickup}
        destination={ride.destination}
        stops={ride.stops}
        driver={isSearching ? null : driverLoc}
        enrouteFrom={isSearching ? null : ride.assigned_driver?.start}
        style={StyleSheet.absoluteFill}
      />

      <Pressable testID="ride-back" onPress={() => router.replace("/(customer)")} style={[styles.backBtn, { top: insets.top + spacing.sm }]}>
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
      </Pressable>

      {isSearching ? (
        <SearchingSheet
          ride={ride}
          offers={offers}
          onAccept={accept}
          selecting={selecting}
          onCancel={cancel}
          insets={insets}
        />
      ) : status === "completed" ? (
        <CompletedSheet ride={ride} insets={insets} />
      ) : (
        <TrackingSheet ride={ride} track={track} status={status} onCancel={cancel} insets={insets} rideId={id!} />
      )}
    </View>
  );
}

function SearchingSheet({ ride, offers, onAccept, selecting, onCancel, insets }: any) {
  return (
    <View style={[styles.sheet, { maxHeight: "68%", paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recLabel}>Recommended fare</Text>
          <Text style={styles.recFare}>${ride.recommended_fare.toFixed(2)}</Text>
          <Text style={styles.recRange}>
            Offers range ${ride.fare_min.toFixed(0)}–${ride.fare_max.toFixed(0)} · {ride.distance_miles} mi
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <ActivityIndicator size="small" color={colors.brandPrimary} />
          <Text style={styles.liveText}>{offers.length}/5 offers</Text>
        </View>
      </View>

      <Text style={styles.compareTitle}>Compare driver offers</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}>
        {offers.length === 0 ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.waitingText}>Waiting for nearby drivers to send offers…</Text>
          </View>
        ) : (
          offers.map((o: any) => (
            <View key={o.id} style={styles.bidCard} testID={`offer-${o.id}`}>
              <Avatar uri={o.driver.photo} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{o.driver.name}</Text>
                <Text style={styles.vehicle}>{o.driver.color} {o.driver.vehicle}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text style={styles.metaText}>{o.driver.rating.toFixed(1)}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Ionicons name="time-outline" size={12} color={colors.muted} />
                  <Text style={styles.metaText}>{o.eta_minutes} min</Text>
                </View>
              </View>
              <View style={styles.bidRight}>
                <Text style={styles.bidFare}>${o.fare.toFixed(2)}</Text>
                <Pressable
                  testID={`accept-${o.id}`}
                  onPress={() => onAccept(o)}
                  style={styles.acceptBtn}
                  disabled={!!selecting}
                >
                  {selecting === o.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.acceptText}>Accept</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Button title="Cancel Request" variant="secondary" onPress={onCancel} testID="cancel-request" />
    </View>
  );
}

function TrackingSheet({ ride, track, status, onCancel, insets, rideId }: any) {
  const d = ride.assigned_driver || {};
  const eta = track?.eta_minutes ?? d.eta_minutes ?? 0;
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.statusBanner}>
        <Text style={styles.statusBannerText}>{STATUS_TEXT[status] || status}</Text>
        {status !== "arrived" && (
          <View style={styles.etaPill}>
            <Text style={styles.etaNum}>{eta}</Text>
            <Text style={styles.etaUnit}>min</Text>
          </View>
        )}
      </View>

      <View style={styles.driverRow}>
        <Avatar uri={d.photo} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{d.name}</Text>
          <Text style={styles.vehicle}>{d.color} {d.vehicle} · {d.plate}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={12} color={colors.warning} />
            <Text style={styles.metaText}>{(d.rating ?? 5).toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.bidFare}>${(ride.final_fare ?? ride.recommended_fare).toFixed(2)}</Text>
      </View>

      <View style={styles.actionRow}>
        <ActionBtn icon="chatbubble-ellipses" label="Chat" onPress={() => router.push(`/chat/${rideId}`)} testID="open-chat" />
        <ActionBtn icon="call" label="Call" onPress={() => Linking.openURL("tel:+14070000000")} testID="call-driver" />
        <ActionBtn icon="close-circle" label="Cancel" onPress={onCancel} danger testID="cancel-trip" />
      </View>
    </View>
  );
}

function CompletedSheet({ ride, insets }: any) {
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.completeIcon}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
      </View>
      <Text style={styles.completeTitle}>Trip completed</Text>
      <Text style={styles.completeFare}>${(ride.final_fare ?? ride.recommended_fare).toFixed(2)}</Text>
      <Text style={styles.completeSub}>{ride.pickup.label} → {ride.destination.label}</Text>
      <Button title="Done" onPress={() => router.replace("/(customer)")} testID="trip-done" style={{ marginTop: spacing.lg }} />
    </View>
  );
}

function ActionBtn({ icon, label, onPress, danger, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.actionBtn}>
      <View style={[styles.actionIcon, danger && { backgroundColor: "#fee2e2" }]}>
        <Ionicons name={icon} size={22} color={danger ? colors.error : colors.brandPrimary} />
      </View>
      <Text style={[styles.actionLabel, danger && { color: colors.error }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef1f4" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
    zIndex: 5,
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
  summaryRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  recLabel: { fontFamily: font.medium, fontSize: 12, color: colors.muted },
  recFare: { fontFamily: font.monoBold, fontSize: 32, color: colors.onSurface },
  recRange: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill },
  liveText: { fontFamily: font.semibold, fontSize: 12, color: colors.brandPrimary },
  compareTitle: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.md },
  waiting: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  waitingText: { fontFamily: font.medium, fontSize: 14, color: colors.muted, textAlign: "center" },
  bidCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowSoft,
  },
  driverName: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  vehicle: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { fontFamily: font.mono, fontSize: 12, color: colors.onSurfaceSecondary },
  metaDot: { color: colors.muted, marginHorizontal: 2 },
  bidRight: { alignItems: "flex-end", gap: 6 },
  bidFare: { fontFamily: font.monoBold, fontSize: 18, color: colors.onSurface },
  acceptBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", minWidth: 78 },
  acceptText: { fontFamily: font.semibold, fontSize: 14, color: "#fff" },
  statusBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  statusBannerText: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface, flex: 1 },
  etaPill: { alignItems: "center", backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  etaNum: { fontFamily: font.monoBold, fontSize: 22, color: colors.brandPrimary },
  etaUnit: { fontFamily: font.medium, fontSize: 10, color: colors.brandPrimary, marginTop: -2 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actionRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { alignItems: "center", gap: 6 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.onSurfaceSecondary },
  completeIcon: { alignItems: "center", marginVertical: spacing.sm },
  completeTitle: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface, textAlign: "center" },
  completeFare: { fontFamily: font.monoBold, fontSize: 30, color: colors.onSurface, textAlign: "center", marginVertical: spacing.xs },
  completeSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
});
