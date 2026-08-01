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
  Modal,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";

import MapView, { LatLng } from "@/src/components/MapView";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import VehicleImage from "@/src/components/VehicleImage";
import StripeCardForm from "@/src/components/StripeCardForm";
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

const STRIPE_CARD_FLOW = !!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

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
  const { height: winH } = useWindowDimensions();

  const [ride, setRide] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [track, setTrack] = useState<any>(null);
  const [status, setStatus] = useState<string>("searching");
  const [selecting, setSelecting] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<{ enabled: boolean; has_card: boolean } | null>(null);
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [cardSecret, setCardSecret] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const spokenRef = useRef<string | null>(null);
  const hasDriverRef = useRef(false);
  hasDriverRef.current = !!ride?.assigned_driver;

  useEffect(() => {
    api(`/rides/${id}`).then((r: any) => {
      setRide(r.ride);
      setStatus(r.ride.status);
      // Don't announce the status that was already active when the screen opened.
      spokenRef.current = r.ride.status;
    });
  }, [id]);

  // Load the rider's payment-method status so we can prompt for a card on accept.
  useEffect(() => {
    api("/payments/method")
      .then((m: any) => setPayMethod({ enabled: !!m.enabled, has_card: !!m.has_card }))
      .catch(() => setPayMethod({ enabled: false, has_card: false }));
  }, []);

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
      const s = statusRef.current;
      const needsOffers = s === "searching" || (s === "scheduled" && !hasDriverRef.current);
      if (needsOffers) {
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

  const confirmSelect = async (offer: any) => {
    setSelecting(offer.id);
    setAcceptError(null);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const r: any = await api(`/rides/${id}/select`, { method: "POST", body: { offer_id: offer.id } });
      setRide(r.ride);
      setStatus(r.ride.status);
    } catch (e: any) {
      setAcceptError(e?.message || "Could not confirm this offer. Please try again.");
      setSelecting(null);
    }
  };

  const accept = async (offer: any) => {
    setAcceptError(null);
    unlockSpeech();
    // Card payments enabled but no card saved yet → collect one before confirming.
    if (payMethod?.enabled && !payMethod?.has_card) {
      setPendingOffer(offer);
      setSelecting(offer.id);
      try {
        const r: any = await api("/payments/setup-intent", { method: "POST" });
        setCardSecret(r.client_secret);
      } catch (e: any) {
        setAcceptError(e?.message || "Could not start card setup. Please try again.");
        setPendingOffer(null);
        setSelecting(null);
      }
      return;
    }
    await confirmSelect(offer);
  };

  const onCardSaved = async (setupIntentId: string) => {
    try {
      await api("/payments/setup-complete", { method: "POST", body: { setup_intent_id: setupIntentId } });
      setCardSecret(null);
      setPayMethod({ enabled: true, has_card: true });
      const offer = pendingOffer;
      setPendingOffer(null);
      if (offer) await confirmSelect(offer);
    } catch (e: any) {
      setAcceptError(e?.message || "Could not save your card. Please try again.");
    }
  };

  const closeCardSheet = () => {
    setCardSecret(null);
    setPendingOffer(null);
    setSelecting(null);
  };

  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancel = async () => {
    setCancelError(null);
    setCancelBusy(true);
    try {
      const r: any = await api(`/rides/${id}/cancel`, { method: "POST" });
      setConfirmCancel(false);
      const fee = r?.cancellation_fee || 0;
      if (fee > 0) {
        router.replace({ pathname: "/(customer)/trips", params: { cancelled: `A $${fee.toFixed(2)} cancellation fee was charged.` } });
      } else {
        router.replace("/(customer)");
      }
    } catch (e: any) {
      setCancelError(e?.message || "Could not cancel this ride. Please try again.");
    } finally {
      setCancelBusy(false);
    }
  };

  const [tipState, setTipState] = useState<number | null>(null);
  const [tipFeedback, setTipFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const tip = tipState ?? track?.tip ?? 0;
  const addTip = async (amount: number) => {
    setTipState(amount);
    setTipFeedback(null);
    Haptics.selectionAsync().catch(() => {});
    try {
      const r: any = await api(`/rides/${id}/tip`, { method: "POST", body: { amount } });
      if (r?.charged) setTipFeedback({ ok: true, msg: `Tip of $${amount.toFixed(2)} charged to your card.` });
    } catch (e: any) {
      setTipState(null);
      setTipFeedback({ ok: false, msg: e?.message || "Could not charge the tip. Please try again." });
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
  const onTrip = status === "in_progress" || status === "completed";
  const showOffers = isSearching || (status === "scheduled" && !ride.assigned_driver);
  const scheduledConfirmed = status === "scheduled" && !!ride.assigned_driver;
  const overview = showOffers || scheduledConfirmed;

  return (
    <View style={styles.container}>
      <MapView
        pickup={overview ? ride.pickup : onTrip ? null : ride.pickup}
        pulsePickup={!overview && !onTrip}
        destination={overview ? ride.destination : onTrip ? ride.destination : null}
        stops={onTrip ? ride.stops : overview ? ride.stops : []}
        driver={overview ? null : driverLoc}
        enrouteFrom={overview ? null : onTrip ? ride.pickup : ride.assigned_driver?.start}
        chaseTo={overview ? null : onTrip ? ride.destination : ride.pickup}
        focusPoint={status === "arrived" ? (driverLoc || ride.pickup) : null}
        bottomInset={overview ? winH * 0.6 : 0}
        style={StyleSheet.absoluteFill}
      />

      <Pressable testID="ride-back" onPress={() => router.replace("/(customer)")} style={[styles.backBtn, { top: insets.top + spacing.sm }]}>
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
      </Pressable>

      {showOffers ? (
        <SearchingSheet
          ride={ride}
          offers={offers}
          onAccept={accept}
          selecting={selecting}
          acceptError={acceptError}
          onCancel={cancel}
          insets={insets}
          scheduled={status === "scheduled"}
        />
      ) : status === "completed" ? (
        <CompletedSheet ride={ride} track={track} insets={insets} tip={tip} onTip={addTip} tipFeedback={tipFeedback} rideId={id!} />
      ) : scheduledConfirmed ? (
        <ScheduledSheet ride={ride} onCancel={() => setConfirmCancel(true)} insets={insets} />
      ) : (
        <TrackingSheet ride={ride} track={track} status={status} onCancel={cancel} insets={insets} rideId={id!} tip={tip} onTip={addTip} />
      )}

      <CancelConfirmModal
        visible={confirmCancel}
        scheduledTime={ride.scheduled_time}
        busy={cancelBusy}
        error={cancelError}
        onClose={() => { setConfirmCancel(false); setCancelError(null); }}
        onConfirm={cancel}
        insets={insets}
      />

      <CardEntrySheet
        visible={!!cardSecret}
        clientSecret={cardSecret}
        fare={pendingOffer?.fare}
        driverName={pendingOffer?.driver?.name}
        onSaved={onCardSaved}
        onError={setAcceptError}
        onClose={closeCardSheet}
        insets={insets}
      />
    </View>
  );
}

function CardEntrySheet({ visible, clientSecret, fare, driverName, onSaved, onError, onClose, insets }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.cardBackdrop}>
        <View style={[styles.cardSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.cardGrip} />
          <View style={styles.cardHeadRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadTitle}>Add a payment method</Text>
              <Text style={styles.cardHeadSub}>
                {typeof fare === "number"
                  ? `To confirm ${driverName || "this driver"}'s $${fare.toFixed(2)} fare, add a card or pay with a wallet.`
                  : "Add a card or pay with Apple Pay / Google Pay to confirm your ride."}
              </Text>
            </View>
            <Pressable testID="card-sheet-close" onPress={onClose} hitSlop={10} style={styles.cardClose}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>

          {clientSecret ? (
            <StripeCardForm clientSecret={clientSecret} onSaved={onSaved} onError={onError} ctaLabel="Save & confirm ride" />
          ) : (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.xl }} />
          )}

          <Text style={styles.cardHelp}>You won't be charged until a driver is assigned. Test card: 4242 4242 4242 4242.</Text>
        </View>
      </View>
    </Modal>
  );
}

function fmtWhen(iso?: string): string {
  if (!iso) return "your scheduled time";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "your scheduled time";
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ScheduledSheet({ ride, onCancel, insets }: any) {
  const d = ride.assigned_driver || {};
  return (
    <View style={[styles.sheet, { maxHeight: "70%", paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.schedBanner}>
        <Ionicons name="calendar" size={15} color={colors.brandPrimary} />
        <Text style={styles.schedBannerText}>Scheduled · Pickup {fmtWhen(ride.scheduled_time)}</Text>
      </View>

      <Text style={styles.compareTitle}>Your driver</Text>
      <View style={styles.driverCard}>
        <Avatar uri={d.photo} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{d.name || "Your driver"}</Text>
          <Text style={styles.driverMetaText}>{[d.color, d.vehicle].filter(Boolean).join(" ")}</Text>
          <View style={styles.driverMetaRow}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={styles.driverMetaText}>{(d.rating ?? 5).toFixed(1)}</Text>
            {d.plate ? <Text style={styles.platePill}>{d.plate}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.recLabel}>Fare</Text>
          <Text style={styles.driverFare}>${(ride.final_fare ?? ride.recommended_fare).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.routeBox}>
        <View style={styles.routeCol}>
          <Ionicons name="ellipse" size={9} color={colors.success} />
          <View style={styles.routeLine} />
          <Ionicons name="location" size={13} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={styles.routeText} numberOfLines={1}>{ride.pickup.label}</Text>
          <Text style={styles.routeText} numberOfLines={1}>{ride.destination.label}</Text>
        </View>
      </View>

      <Text style={styles.cancelHint}>You can cancel up to 5 minutes before pickup. A $5.00 cancellation fee applies once a driver is assigned.</Text>
      <Pressable testID="cancel-scheduled" onPress={onCancel} style={styles.cancelBtn}>
        <Text style={styles.cancelBtnText}>Cancel scheduled ride</Text>
      </Pressable>
    </View>
  );
}

function CancelConfirmModal({ visible, scheduledTime, busy, error, onClose, onConfirm, insets }: any) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.confirmBackdrop}>
        <View style={[styles.confirmCard, { marginBottom: insets.bottom + spacing.xl }]}>
          <Ionicons name="alert-circle" size={34} color={colors.warning} />
          <Text style={styles.confirmTitle}>Cancel this scheduled ride?</Text>
          <Text style={styles.confirmSub}>
            Pickup is set for {fmtWhen(scheduledTime)}. A $5.00 cancellation fee will be charged to your card.
          </Text>
          {error ? <Text style={styles.confirmError}>{error}</Text> : null}
          <Pressable testID="confirm-cancel-yes" onPress={onConfirm} disabled={busy} style={[styles.confirmDanger, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmDangerText}>Cancel & pay $5.00 fee</Text>}
          </Pressable>
          <Pressable testID="confirm-cancel-no" onPress={onClose} disabled={busy} style={styles.confirmGhost}>
            <Text style={styles.confirmGhostText}>Keep my ride</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}


function SearchingSheet({ ride, offers, onAccept, selecting, acceptError, onCancel, insets, scheduled }: any) {
  return (
    <View style={[styles.sheet, { maxHeight: "68%", paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      {scheduled ? (
        <View style={styles.schedBanner}>
          <Ionicons name="calendar" size={15} color={colors.brandPrimary} />
          <Text style={styles.schedBannerText}>Pick a driver for your scheduled pickup — they'll be locked in for {fmtWhen(ride.scheduled_time)}.</Text>
        </View>
      ) : null}
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

      {acceptError ? (
        <View style={styles.acceptErrorBox} testID="accept-error">
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.acceptErrorText}>{acceptError}</Text>
        </View>
      ) : null}

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

      {!locked ? (
        <View style={styles.actionRow}>
          <ActionBtn icon="chatbubble-ellipses" label="Chat" onPress={() => router.push(`/chat/${rideId}`)} testID="open-chat" />
          <ActionBtn icon="call" label="Call" onPress={() => Linking.openURL("tel:+14070000000")} testID="call-driver" />
          <ActionBtn icon="close-circle" label="Cancel" onPress={onCancel} danger testID="cancel-trip" />
        </View>
      ) : (
        <Text style={styles.lockHint}>Sit back and enjoy your ride — trip options return after drop-off.</Text>
      )}
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

function CompletedSheet({ ride, track, insets, tip, onTip, tipFeedback, rideId }: any) {
  const fare = track?.final_fare ?? ride.final_fare ?? ride.recommended_fare;
  const paid = track?.payment_status === "paid";
  const total = fare + Number(tip || 0);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  const pay = async () => {
    setPaying(true);
    setPayErr(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const r: any = await api(`/payments/checkout/session`, {
        method: "POST",
        body: { ride_id: rideId, origin_url: origin },
      });
      if (r.url && typeof window !== "undefined") {
        window.location.href = r.url;
      } else {
        setPayErr("Could not start payment. Please try again.");
        setPaying(false);
      }
    } catch (e: any) {
      setPayErr(e?.message || "Could not start payment. Please try again.");
      setPaying(false);
    }
  };

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.completeIcon}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
      </View>
      <Text style={styles.completeTitle}>Trip completed</Text>
      <Text style={styles.completeFare}>${fare.toFixed(2)}</Text>
      {tip > 0 ? <Text style={styles.completeTip}>+ ${Number(tip).toFixed(2)} tip · Total ${total.toFixed(2)}</Text> : null}
      <Text style={styles.completeSub}>{ride.pickup.label} → {ride.destination.label}</Text>

      {STRIPE_CARD_FLOW ? (
        <>
          <View style={[styles.paidBox, !paid && { backgroundColor: colors.surfaceSecondary }]} testID="payment-paid">
            <Ionicons name={paid ? "card" : "time"} size={18} color={paid ? colors.success : colors.muted} />
            <Text style={[styles.paidText, !paid && { color: colors.muted }]}>
              {paid ? `Charged $${fare.toFixed(2)} to your card on file` : "Finalizing fare charge…"}
            </Text>
          </View>
          <TipSection tip={tip} onTip={onTip} />
          {tipFeedback ? (
            <Text style={tipFeedback.ok ? styles.tipOk : styles.payErr}>{tipFeedback.msg}</Text>
          ) : null}
          <Button title="Done" onPress={() => router.replace("/(customer)")} testID="trip-done" style={{ marginTop: spacing.lg }} />
        </>
      ) : paid ? (
        <>
          <View style={styles.paidBox} testID="payment-paid">
            <Ionicons name="card" size={18} color={colors.success} />
            <Text style={styles.paidText}>Paid ${(track?.paid_amount ?? total).toFixed(2)}</Text>
          </View>
          <Button title="Done" onPress={() => router.replace("/(customer)")} testID="trip-done" style={{ marginTop: spacing.lg }} />
        </>
      ) : (
        <>
          <TipSection tip={tip} onTip={onTip} />
          {payErr ? <Text style={styles.payErr}>{payErr}</Text> : null}
          <Button
            title={`Pay $${total.toFixed(2)}`}
            onPress={pay}
            loading={paying}
            testID="pay-now"
            style={{ marginTop: spacing.lg }}
          />
          <Pressable testID="pay-later" onPress={() => router.replace("/(customer)")}>
            <Text style={styles.payLater}>Pay later</Text>
          </Pressable>
        </>
      )}
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
  cardBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  cardSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  cardGrip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.lg },
  cardHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.lg },
  cardHeadTitle: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  cardHeadSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  cardClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cardHelp: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: spacing.lg, textAlign: "center" },
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
  schedBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  schedBannerText: { flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.brandPrimary, lineHeight: 17 },
  driverCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  driverMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  driverMetaText: { fontFamily: font.medium, fontSize: 12.5, color: colors.onSurfaceSecondary },
  driverDot: { color: colors.muted, marginHorizontal: 2 },
  platePill: { alignSelf: "flex-start", marginTop: 6, fontFamily: font.monoBold, fontSize: 11, color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  driverFare: { fontFamily: font.monoBold, fontSize: 18, color: colors.onSurface },
  cancelHint: { fontFamily: font.regular, fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: spacing.md },
  cancelBtn: { height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontFamily: font.bold, fontSize: 15, color: colors.error },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", paddingHorizontal: spacing.lg },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  confirmTitle: { fontFamily: font.bold, fontSize: 19, color: colors.onSurface, textAlign: "center" },
  confirmSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  confirmError: { fontFamily: font.medium, fontSize: 13, color: colors.error, textAlign: "center" },
  confirmDanger: { alignSelf: "stretch", height: 52, borderRadius: radius.md, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  confirmDangerText: { fontFamily: font.bold, fontSize: 15, color: "#fff" },
  confirmGhost: { alignSelf: "stretch", height: 48, alignItems: "center", justifyContent: "center" },
  confirmGhostText: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurfaceSecondary },
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
  paidBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.lg, backgroundColor: "#ecfdf5", borderRadius: radius.md, paddingVertical: spacing.md },
  paidText: { fontFamily: font.bold, fontSize: 15, color: colors.success },
  tipOk: { fontFamily: font.semibold, fontSize: 13, color: colors.success, textAlign: "center", marginTop: spacing.md },
  acceptErrorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  acceptErrorText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.error },
  payErr: { fontFamily: font.medium, fontSize: 13, color: colors.error, textAlign: "center", marginTop: spacing.md },
  payLater: { fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: "center", marginTop: spacing.md },
});
