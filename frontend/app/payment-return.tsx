import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";

import Button from "@/src/components/Button";
import { api } from "@/src/api";
import { colors, font, spacing } from "@/src/theme";

type Phase = "checking" | "success" | "failed" | "timeout";

const MAX_POLLS = 8;

export default function PaymentReturn() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const [phase, setPhase] = useState<Phase>("checking");
  const [amount, setAmount] = useState<number>(0);
  const rideIdRef = useRef<string | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!session_id) {
      setPhase("failed");
      return;
    }
    const check = async () => {
      if (cancelled) return;
      try {
        const r: any = await api(`/payments/checkout/status/${session_id}`);
        rideIdRef.current = r.ride_id;
        if (r.payment_status === "paid") {
          setAmount((r.amount_total || 0) / 100);
          setPhase("success");
          return;
        }
        if (r.status === "expired") {
          setPhase("failed");
          return;
        }
      } catch {
        setPhase("failed");
        return;
      }
      polls.current += 1;
      if (polls.current >= MAX_POLLS) {
        setPhase("timeout");
        return;
      }
      setTimeout(check, 1800);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [session_id]);

  const goHome = () => router.replace("/(customer)");
  const backToRide = () =>
    rideIdRef.current ? router.replace(`/ride/${rideIdRef.current}`) : goHome();

  return (
    <View style={styles.container}>
      {phase === "checking" && (
        <>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.title}>Confirming your payment…</Text>
          <Text style={styles.sub}>Please wait a moment.</Text>
        </>
      )}
      {phase === "success" && (
        <>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <Text style={styles.title}>Payment successful</Text>
          <Text style={styles.fare}>${amount.toFixed(2)}</Text>
          <Text style={styles.sub}>Thanks for riding with Getaride Orlando!</Text>
          <Button title="Done" onPress={goHome} testID="payment-done" style={{ marginTop: spacing.xl, alignSelf: "stretch" }} />
        </>
      )}
      {(phase === "failed" || phase === "timeout") && (
        <>
          <Ionicons name="alert-circle" size={72} color={colors.error} />
          <Text style={styles.title}>
            {phase === "timeout" ? "Still processing" : "Payment not completed"}
          </Text>
          <Text style={styles.sub}>
            {phase === "timeout"
              ? "Your payment is taking longer than expected. You can check again from your trip."
              : "We couldn't confirm your payment. You can try again."}
          </Text>
          <Button title="Back to trip" onPress={backToRide} testID="payment-retry" style={{ marginTop: spacing.xl, alignSelf: "stretch" }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  title: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface, textAlign: "center", marginTop: spacing.lg },
  fare: { fontFamily: font.monoBold, fontSize: 32, color: colors.onSurface, marginVertical: spacing.xs },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: spacing.sm },
});
