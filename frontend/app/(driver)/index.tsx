import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import Button from "@/src/components/Button";
import Logo from "@/src/components/Logo";
import MapView from "@/src/components/MapView";
import { api } from "@/src/api";
import { unlockSpeech } from "@/src/speech";
import { playRequestChime, unlockSound } from "@/src/sound";
import { colors, font, radius, shadow, shadowSoft, spacing } from "@/src/theme";

function RequestPopup({ req, secsLeft, bottom, onSkip, onBid }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== "web", friction: 6, tension: 70 }).start();
  }, [req.id]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  return (
    <Animated.View style={[styles.popupCard, { bottom, opacity: anim, transform: [{ translateY }, { scale }] }]} testID={`request-${req.id}`}>
      <View style={styles.popupTimerRow}>
        <View style={styles.popupBadge}>
          <Ionicons name="flash" size={13} color="#fff" />
          <Text style={styles.popupBadgeText}>New ride request</Text>
        </View>
        <View style={styles.popupCountdown}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.popupSecs} testID="popup-countdown">{secsLeft}s</Text>
        </View>
      </View>
      <View style={styles.reqTop}>
        <View style={styles.reqRating}>
          <Ionicons name="people" size={18} color={colors.brandPrimary} />
          <Text style={styles.reqName}>{req.passengers ?? 1} Passenger{(req.passengers ?? 1) === 1 ? "" : "s"}</Text>
          <Ionicons name="star" size={12} color={colors.warning} />
          <Text style={styles.metaText}>{req.customer_rating}</Text>
        </View>
        <Text style={styles.reqRec}>${req.recommended_fare.toFixed(2)}</Text>
      </View>
      <View style={styles.reqRoute}>
        <View style={styles.routeCol}>
          <Ionicons name="ellipse" size={9} color={colors.success} />
          <View style={styles.routeLine} />
          <Ionicons name="location" size={12} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={styles.routeText} numberOfLines={1}>{req.pickup.label}</Text>
          <Text style={styles.routeText} numberOfLines={1}>{req.destination.label}</Text>
        </View>
      </View>
      <View style={styles.metaChips}>
        <View style={styles.metaChip}>
          <Ionicons name="navigate-outline" size={13} color={colors.brandPrimary} />
          <Text style={styles.metaChipText}>{req.pickup_eta_min ?? 5} min to pickup</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="time-outline" size={13} color={colors.brandPrimary} />
          <Text style={styles.metaChipText}>{req.duration_min} min trip</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="speedometer-outline" size={13} color={colors.brandPrimary} />
          <Text style={styles.metaChipText}>{req.distance_miles} mi</Text>
        </View>
        {req.required_class_label ? (
          <View style={styles.metaChip}>
            <Ionicons name="car-sport" size={13} color={colors.brandPrimary} />
            <Text style={styles.metaChipText}>{req.required_class_label}</Text>
          </View>
        ) : null}
        <View style={styles.metaChip}>
          <Ionicons name="bag-handle" size={13} color={colors.brandPrimary} />
          <Text style={styles.metaChipText}>{req.bags ?? 0} bag{(req.bags ?? 0) === 1 ? "" : "s"}</Text>
        </View>
      </View>
      <View style={styles.popupActions}>
        <Pressable testID={`skip-${req.id}`} onPress={onSkip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
        <Pressable testID={`bid-${req.id}`} onPress={onBid} style={styles.popupBidBtn}>
          <Text style={styles.bidBtnText}>Set Fare · ${req.fare_min.toFixed(0)}–${req.fare_max.toFixed(0)}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function DriverHome() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(false);
  const [approval, setApproval] = useState<string>("approved");
  const [requests, setRequests] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [bidFare, setBidFare] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [secsLeft, setSecsLeft] = useState(25);
  const [holding, setHolding] = useState(false);
  const seenReqRef = useRef<Set<string>>(new Set());
  const current = holding ? null : queue[0] || null;

  // Detect the driver's location for the "go online" live-requests map.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let done = false;
    const apply = (lat: number, lng: number) => { if (!done) { done = true; setDriverLoc({ lat, lng }); } };
    const ipFallback = async () => {
      if (done) return;
      try {
        const r = await fetch("https://ipapi.co/json/");
        const j = await r.json();
        if (typeof j.latitude === "number" && typeof j.longitude === "number") apply(j.latitude, j.longitude);
      } catch {}
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => apply(p.coords.latitude, p.coords.longitude),
        () => ipFallback(),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
      setTimeout(ipFallback, 9000);
    } else {
      ipFallback();
    }
  }, []);

  // Map pins: real request pickups when online, scattered preview pins when offline.
  const reqMarkers = useMemo(() => {
    if (online && requests.length) {
      return requests.map((r: any) => ({ lat: r.pickup.lat, lng: r.pickup.lng }));
    }
    if (!driverLoc) return [];
    const seeds = [
      [0.012, -0.018], [-0.02, 0.01], [0.022, 0.015], [-0.014, -0.02], [0.006, 0.026], [-0.026, 0.004],
    ];
    return seeds.map(([dlat, dlng]) => ({ lat: driverLoc.lat + dlat, lng: driverLoc.lng + dlng }));
  }, [online, requests, driverLoc?.lat, driverLoc?.lng]);

  // Queue newly-arrived requests as map popups.
  useEffect(() => {
    if (!online) return;
    const fresh = requests.filter((r: any) => !seenReqRef.current.has(r.id));
    if (fresh.length) {
      fresh.forEach((r: any) => seenReqRef.current.add(r.id));
      setQueue((q) => [...q, ...fresh]);
      playRequestChime();
    }
  }, [requests, online]);

  // Each popup stays for 25 seconds, then the next one shows.
  useEffect(() => {
    if (!current) return;
    setSecsLeft(25);
    const start = Date.now();
    const iv = setInterval(() => {
      const left = 25 - Math.floor((Date.now() - start) / 1000);
      if (left <= 0) {
        clearInterval(iv);
        setQueue((q) => q.slice(1));
      } else {
        setSecsLeft(left);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [current?.id]);

  const dismissCurrent = () => {
    setQueue((q) => q.slice(1));
    setHolding(true);
    setTimeout(() => setHolding(false), 3000);
  };

  const poll = useCallback(async () => {
    try {
      const a: any = await api("/driver/active");
      setActive(a.ride);
      if (a.approval_status) setApproval(a.approval_status);
      const isOnline = !!a.online;
      setOnline(isOnline);
      if (isOnline && !a.ride) {
        const r: any = await api("/driver/requests");
        setRequests(r.requests);
      } else if (!isOnline) {
        setRequests([]);
        setQueue([]);
        seenReqRef.current.clear();
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      poll();
      const iv = setInterval(poll, 3000);
      return () => clearInterval(iv);
    }, [poll])
  );

  const toggleOnline = async () => {
    if (approval !== "approved") {
      setNotice(approval === "declined"
        ? "Your driver application was declined. Please contact support."
        : "Your account is pending approval. You can go online once Getaride approves you.");
      return;
    }
    const next = !online;
    if (!next && active) {
      setNotice("Finish your active trip before going offline.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    unlockSound();
    setOnline(next);
    try {
      await api("/driver/online", { method: "POST", body: { status: next ? "online" : "offline" } });
      if (next) poll();
      else setRequests([]);
    } catch (e: any) {
      setOnline(!next);
      setNotice(e?.message || "Couldn't update your status.");
    }
  };

  const openBid = (req: any) => {
    setSelected(req);
    setBidFare(req.recommended_fare);
  };

  const adjust = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setBidFare((f) => {
      const v = Math.round((f + delta) * 2) / 2;
      return Math.min(selected.fare_max, Math.max(selected.fare_min, v));
    });
  };

  const submitBid = async (fare: number) => {
    setSubmitting(true);
    unlockSpeech();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await api(`/rides/${selected.id}/bid`, { method: "POST", body: { fare } });
      const rideId = selected.id;
      setSelected(null);
      router.push(`/driver-trip/${rideId}`);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Logo size={32} showWord showMark={false} />
        <Pressable testID="online-toggle" onPress={toggleOnline} style={[styles.onlinePill, online && styles.onlinePillActive, approval !== "approved" && styles.onlinePillPending]}>
          {approval === "pending" ? (
            <>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={[styles.onlineText, { color: colors.warning }]}>Pending</Text>
            </>
          ) : approval === "declined" ? (
            <>
              <Ionicons name="close-circle-outline" size={14} color={colors.error} />
              <Text style={[styles.onlineText, { color: colors.error }]}>Declined</Text>
            </>
          ) : (
            <>
              <View style={[styles.statusDot, { backgroundColor: online ? colors.success : colors.muted }]} />
              <Text style={[styles.onlineText, online && { color: colors.success }]}>{online ? "Online" : "Offline"}</Text>
            </>
          )}
        </Pressable>
      </View>

      {notice ? (
        <View style={styles.notice} testID="driver-notice">
          <Ionicons name="information-circle" size={16} color={colors.brandPrimary} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {approval !== "approved" ? (
        <View style={styles.pendingWrap}>
          <View style={styles.pendingCard} testID="approval-banner">
            <View style={[styles.pendingIcon, approval === "declined" && { backgroundColor: "#fee2e2" }]}>
              <Ionicons
                name={approval === "declined" ? "close-circle" : "hourglass-outline"}
                size={36}
                color={approval === "declined" ? colors.error : colors.warning}
              />
            </View>
            <Text style={styles.pendingTitle}>
              {approval === "declined" ? "Application declined" : "Application under review"}
            </Text>
            <Text style={styles.pendingSub}>
              {approval === "declined"
                ? "Unfortunately your driver application wasn't approved. Reach out to Getaride support for more details."
                : "Thanks for signing up! Our team is reviewing your details. You'll be able to go online and accept rides as soon as you're approved."}
            </Text>
            <View style={styles.pendingSteps}>
              {["Account created", "Documents submitted", approval === "declined" ? "Declined" : "Awaiting approval"].map((s, i) => (
                <View key={s} style={styles.pendingStepRow}>
                  <Ionicons
                    name={i < 2 ? "checkmark-circle" : approval === "declined" ? "close-circle" : "ellipse-outline"}
                    size={18}
                    color={i < 2 ? colors.success : approval === "declined" ? colors.error : colors.muted}
                  />
                  <Text style={styles.pendingStepText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : active ? (
        <Pressable testID="active-banner" style={styles.activeBanner} onPress={() => { unlockSpeech(); router.push(`/driver-trip/${active.id}`); }}>
          <View style={styles.activeIcon}>
            <Ionicons name="car-sport" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeTitle}>Active trip in progress</Text>
            <Text style={styles.activeSub}>{active.pickup.label} → {active.destination.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.brandPrimary} />
        </Pressable>
      ) : !online ? (
        <View style={styles.offlineMapWrap}>
          <MapView requestMarkers={reqMarkers} centerOn={driverLoc} style={StyleSheet.absoluteFill} />
          <View style={[styles.liveOverlay, { pointerEvents: "none" }]}>
            <View style={styles.livePill}>
              <View style={styles.livePulse} />
              <Text style={styles.livePillText}>{reqMarkers.length} ride requests near you</Text>
            </View>
          </View>
          <View style={[styles.offlineCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.offlineTitle}>{"You're offline"}</Text>
            <Text style={styles.offlineSub}>Go online to start accepting these nearby ride requests.</Text>
            <Button title="Go Online" onPress={toggleOnline} testID="go-online" style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
          </View>
        </View>
      ) : (
        <View style={styles.offlineMapWrap}>
          <MapView requestMarkers={reqMarkers} centerOn={driverLoc} style={StyleSheet.absoluteFill} />
          <View style={[styles.liveOverlay, { pointerEvents: "none" }]}>
            <View style={styles.livePill}>
              <View style={styles.livePulse} />
              <Text style={styles.livePillText}>{"You're online · "}{requests.length} nearby</Text>
            </View>
          </View>

          {current ? (
            <RequestPopup
              key={current.id}
              req={current}
              secsLeft={secsLeft}
              bottom={insets.bottom + spacing.lg}
              onSkip={dismissCurrent}
              onBid={() => openBid(current)}
            />
          ) : (
            <View style={[styles.waitPill, { bottom: insets.bottom + spacing.lg }]}>
              <ActivityIndicator size="small" color={colors.brandPrimary} />
              <Text style={styles.waitText}>{holding && queue.length > 0 ? "Next request in a moment…" : "Waiting for ride requests near you…"}</Text>
            </View>
          )}
        </View>
      )}

      {selected && (
        <View style={[StyleSheet.absoluteFill, styles.bidOverlay]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={[styles.bidSheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="bid-sheet">
            <View style={styles.handle} />
            <Text style={styles.bidTitle}>Submit your fare</Text>
            <Text style={styles.bidRoute}>{selected.pickup.label} → {selected.destination.label}</Text>

            <View style={styles.stepper}>
              <Pressable testID="fare-minus" onPress={() => adjust(-0.5)} style={styles.stepBtn}>
                <Ionicons name="remove" size={26} color={colors.brandPrimary} />
              </Pressable>
              <View style={styles.fareDisplay}>
                <Text style={styles.fareBig}>${bidFare.toFixed(2)}</Text>
                <Text style={styles.fareHint}>Allowed ${selected.fare_min.toFixed(0)}–${selected.fare_max.toFixed(0)}</Text>
              </View>
              <Pressable testID="fare-plus" onPress={() => adjust(0.5)} style={styles.stepBtn}>
                <Ionicons name="add" size={26} color={colors.brandPrimary} />
              </Pressable>
            </View>

            <Button title={`Submit $${bidFare.toFixed(2)} Bid`} onPress={() => submitBid(bidFare)} loading={submitting} testID="submit-bid" />
            <Button
              title={`Accept Recommended ($${selected.recommended_fare.toFixed(2)})`}
              variant="secondary"
              onPress={() => submitBid(selected.recommended_fare)}
              testID="accept-recommended"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  onlinePillActive: { backgroundColor: "#dcfce7" },
  onlinePillPending: { backgroundColor: colors.surfaceSecondary },
  pendingWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl },
  pendingCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing["2xl"], alignItems: "center", gap: spacing.md, ...shadow },
  pendingIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center" },
  pendingTitle: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  pendingSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  pendingSteps: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  pendingStepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pendingStepText: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontFamily: font.semibold, fontSize: 13, color: colors.muted },
  notice: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  noticeText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.brandPrimary },
  activeBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.xl, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg },
  activeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  activeTitle: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  activeSub: { fontFamily: font.regular, fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 2 },
  offlineState: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing["3xl"] },
  offlineMapWrap: { flex: 1, position: "relative" },
  liveOverlay: { position: "absolute", top: spacing.md, left: 0, right: 0, alignItems: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, ...shadow },
  livePulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  livePillText: { fontFamily: font.semibold, fontSize: 13, color: colors.onSurface },
  waitPill: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, ...shadow },
  waitText: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  popupCard: { position: "absolute", left: spacing.lg, right: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadow },
  popupTimerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  popupBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  popupBadgeText: { fontFamily: font.semibold, fontSize: 12, color: "#fff" },
  popupCountdown: { flexDirection: "row", alignItems: "center", gap: 4 },
  popupSecs: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface, minWidth: 30, textAlign: "right" },
  popupActions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  skipBtn: { paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  skipBtnText: { fontFamily: font.semibold, fontSize: 14, color: colors.muted },
  popupBidBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  offlineCard: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, ...shadow },
  offlineTitle: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  offlineSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  requestsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill },
  liveText: { fontFamily: font.semibold, fontSize: 12, color: colors.brandPrimary },
  reqCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadowSoft, gap: spacing.md },
  reqTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reqRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  reqName: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface, marginRight: 4 },
  metaText: { fontFamily: font.mono, fontSize: 12, color: colors.onSurfaceSecondary },
  reqRec: { fontFamily: font.monoBold, fontSize: 18, color: colors.onSurface },
  reqRoute: { flexDirection: "row", gap: spacing.md },
  routeCol: { alignItems: "center", paddingTop: 2 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  routeText: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  reqFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  metaChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill },
  metaChipText: { fontFamily: font.semibold, fontSize: 12, color: colors.onBrandTertiary },
  reqMeta: { fontFamily: font.regular, fontSize: 12, color: colors.muted, flex: 1 },
  bidBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  bidBtnText: { fontFamily: font.semibold, fontSize: 14, color: "#fff" },
  bidOverlay: { backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", zIndex: 50 },
  bidSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.md, ...shadow },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.md },
  bidTitle: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  bidRoute: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: spacing.lg },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  stepBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  fareDisplay: { alignItems: "center" },
  fareBig: { fontFamily: font.monoBold, fontSize: 40, color: colors.onSurface },
  fareHint: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
});
