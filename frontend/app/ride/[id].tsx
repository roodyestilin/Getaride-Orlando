import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";

import MapView, { LatLng } from "@/src/components/MapView";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import VehicleImage from "@/src/components/VehicleImage";
import { api } from "@/src/api";
import { speak, unlockSpeech } from "@/src/speech";
import { colors, font, radius, shadow, shadowSoft, spacing } from "@/src/theme";

const vehicleDesc = (x: any) => `${x?.color || ""} ${x?.vehicle || ""}`.trim();

const STATUS_TEXT: Record<string, string> = {
  driver_enroute: "Driver is on the way",
  arrived: "Your driver has arrived",
  in_progress: "Enjoy your ride",
  completed: "You've arrived!",
};

function milesBetween(a?: { lat: number; lng: number }, b?: { lat: number; lng: number }): number | null {
  if (!a || !b) return null;
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function arriveClock(mins: number): string {
  const d = new Date(Date.now() + mins * 60000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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
  const spokenRef = useRef<string | null>(null);

  useEffect(() => {
    api(`/rides/${id}`).then((r: any) => {
      setRide(r.ride);
      setStatus(r.ride.status);
      // Don't announce the status that was already active when the screen opened.
      spokenRef.current = r.ride.status;
    });
  }, [id]);

  // Female-voice announcements at each trip status change.
  useEffect(() => {
    const phrases: Record<string, string> = {
      driver_enroute: "Your driver is now on the way.",
      arrived: "Your driver has arrived.",
      in_progress: "Enjoy your ride.",
    };
    const phrase = phrases[status];
    if (phrase && spokenRef.current !== status) {
      spokenRef.current = status;
      speak(phrase);
    }
  }, [status]);

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
    unlockSpeech();
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

  const [tipState, setTipState] = useState<number | null>(null);
  const tip = tipState ?? track?.tip ?? 0;
  const addTip = async (amount: number) => {
    setTipState(amount);
    Haptics.selectionAsync().catch(() => {});
    try {
      await api(`/rides/${id}/tip`, { method: "POST", body: { amount } });
    } catch {
      setTipState(null);
    }
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
        <CompletedSheet ride={ride} track={track} insets={insets} tip={tip} onTip={addTip} />
      ) : (
        <TrackingSheet ride={ride} track={track} status={status} onCancel={cancel} insets={insets} rideId={id!} tip={tip} onTip={addTip} />
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

      <View style={styles.routeBox}>
        <View style={styles.routeCol}>
          <Ionicons name="ellipse" size={9} color={colors.success} />
          <View style={styles.routeLine} />
          {(ride.stops || []).map((_: any, i: number) => (
            <React.Fragment key={i}>
              <Ionicons name="ellipse" size={8} color={colors.warning} />
              <View style={styles.routeLine} />
            </React.Fragment>
          ))}
          <Ionicons name="location" size={13} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={styles.routeText} numberOfLines={1}>{ride.pickup.label}</Text>
          {(ride.stops || []).map((s: any, i: number) => (
            <Text key={i} style={styles.routeStopText} numberOfLines={1}>{s.label || "Stop"}</Text>
          ))}
          <Text style={styles.routeText} numberOfLines={1}>{ride.destination.label}</Text>
        </View>
      </View>

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
                  {milesBetween(ride.pickup, o.driver.start) != null ? (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Ionicons name="navigate-outline" size={12} color={colors.muted} />
                      <Text style={styles.metaText}>{milesBetween(ride.pickup, o.driver.start)!.toFixed(1)} mi away</Text>
                    </>
                  ) : null}
                </View>
              </View>
              <View style={styles.bidRight}>
                <VehicleImage desc={vehicleDesc(o.driver)} width={78} height={48} rounded={10} testID={`offer-vehicle-${o.id}`} />
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

function TrackingSheet({ ride, track, status, onCancel, insets, rideId, tip, onTip }: any) {
  const d = ride.assigned_driver || {};
  const eta = track?.eta_minutes ?? d.eta_minutes ?? 0;
  const locked = status === "in_progress";
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.statusBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusBannerText}>{STATUS_TEXT[status] || status}</Text>
          {eta > 0 ? (
            <Text style={styles.arriveText}>
              {status === "in_progress" ? "Arriving" : "Pickup"} ~{arriveClock(eta)}
            </Text>
          ) : null}
        </View>
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
        <VehicleImage desc={vehicleDesc(d)} width={96} height={62} testID="track-vehicle" />
      </View>

      <View style={styles.actionRow}>
        <ActionBtn icon="chatbubble-ellipses" label="Chat" disabled={locked} onPress={() => router.push(`/chat/${rideId}`)} testID="open-chat" />
        <ActionBtn icon="call" label="Call" disabled={locked} onPress={() => Linking.openURL("tel:+14070000000")} testID="call-driver" />
        <ActionBtn icon="close-circle" label="Cancel" disabled={locked} onPress={onCancel} danger testID="cancel-trip" />
      </View>
      {locked ? <Text style={styles.lockHint}>Chat, call and cancel are paused while your trip is in progress.</Text> : null}

      {status === "in_progress" ? <TipSection tip={tip} onTip={onTip} /> : null}
    </View>
  );
}

function TipSection({ tip, onTip }: any) {
  const presets = [3, 5, 10];
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const isPreset = presets.includes(tip);
  const customActive = customMode || (tip > 0 && !isPreset);
  return (
    <View style={styles.tipBox}>
      <View style={styles.tipHeader}>
        <Ionicons name="heart" size={15} color={colors.brandPrimary} />
        <Text style={styles.tipTitle}>Add a tip</Text>
      </View>
      <Text style={styles.tipSub}>100% goes to your driver</Text>
      <View style={styles.tipRow}>
        {presets.map((p) => {
          const active = tip === p && !customMode;
          return (
            <Pressable key={p} testID={`tip-${p}`} onPress={() => { setCustomMode(false); onTip(p); }} style={[styles.tipChip, active && styles.tipChipActive]}>
              <Text style={[styles.tipChipText, active && styles.tipChipTextActive]}>${p}</Text>
            </Pressable>
          );
        })}
        <Pressable testID="tip-custom" onPress={() => setCustomMode(true)} style={[styles.tipChip, customActive && styles.tipChipActive]}>
          <Text style={[styles.tipChipText, customActive && styles.tipChipTextActive]}>Custom</Text>
        </Pressable>
      </View>
      {customMode ? (
        <View style={styles.customRow}>
          <Text style={styles.customDollar}>$</Text>
          <TextInput
            testID="tip-custom-input"
            value={customVal}
            onChangeText={setCustomVal}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            style={styles.customInput}
          />
          <Pressable testID="tip-custom-apply" onPress={() => { onTip(Math.max(0, parseFloat(customVal) || 0)); setCustomMode(false); }} style={styles.customApply}>
            <Text style={styles.customApplyText}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      {tip > 0 ? (
        <Text style={styles.tipConfirm} testID="tip-confirm">✓ Tip added: ${Number(tip).toFixed(2)} — thank you!</Text>
      ) : (
        <Pressable testID="tip-0" onPress={() => { setCustomMode(false); onTip(0); }}>
          <Text style={styles.tipSkip}>No tip</Text>
        </Pressable>
      )}
    </View>
  );
}

function CompletedSheet({ ride, track, insets, tip, onTip }: any) {
  const fare = track?.final_fare ?? ride.final_fare ?? ride.recommended_fare;
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.completeIcon}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
      </View>
      <Text style={styles.completeTitle}>Trip completed</Text>
      <Text style={styles.completeFare}>${fare.toFixed(2)}</Text>
      {tip > 0 ? <Text style={styles.completeTip}>+ ${Number(tip).toFixed(2)} tip · Total ${(fare + Number(tip)).toFixed(2)}</Text> : null}
      <Text style={styles.completeSub}>{ride.pickup.label} → {ride.destination.label}</Text>

      <TipSection tip={tip} onTip={onTip} />

      <Button title="Done" onPress={() => router.replace("/(customer)")} testID="trip-done" style={{ marginTop: spacing.lg }} />
    </View>
  );
}

function ActionBtn({ icon, label, onPress, danger, disabled, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} style={[styles.actionBtn, disabled && { opacity: 0.4 }]}>
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
  routeBox: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  routeCol: { alignItems: "center", paddingTop: 3 },
  routeLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: colors.border, marginVertical: 3 },
  routeText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  routeStopText: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.onSurfaceSecondary },
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
  arriveText: { fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 },
  lockHint: { fontFamily: font.medium, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.md },
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
  completeTip: { fontFamily: font.semibold, fontSize: 14, color: colors.brandPrimary, textAlign: "center", marginBottom: spacing.xs },
  tipBox: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipTitle: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  tipSub: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  tipRow: { flexDirection: "row", gap: spacing.sm },
  tipChip: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  tipChipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  tipChipText: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  tipChipTextActive: { color: colors.brandPrimary },
  customRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  customDollar: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  customInput: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  customApply: { height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  customApplyText: { fontFamily: font.semibold, fontSize: 14, color: "#fff" },
  tipConfirm: { fontFamily: font.semibold, fontSize: 13, color: colors.success, textAlign: "center", marginTop: spacing.md },
  tipSkip: { fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: "center", marginTop: spacing.md },
});
