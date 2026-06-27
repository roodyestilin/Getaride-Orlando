import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import Button from "@/src/components/Button";
import StripeCardForm from "@/src/components/StripeCardForm";
import { api } from "@/src/api";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

type Method = { enabled: boolean; has_card: boolean; brand?: string | null; last4?: string | null };

export default function PaymentMethods() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const m: any = await api("/payments/method");
      setMethod(m);
    } catch {
      setMethod({ enabled: false, has_card: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startAdd = async () => {
    setError(null);
    setSaved(false);
    setAdding(true);
    try {
      const r: any = await api("/payments/setup-intent", { method: "POST" });
      setClientSecret(r.client_secret);
    } catch (e: any) {
      setError(e?.message || "Could not start card setup.");
      setAdding(false);
    }
  };

  const onSaved = async (setupIntentId: string) => {
    try {
      await api("/payments/setup-complete", { method: "POST", body: { setup_intent_id: setupIntentId } });
      setClientSecret(null);
      setAdding(false);
      setSaved(true);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Could not save your card.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], paddingHorizontal: spacing.xl }}>
      <Pressable testID="pm-back" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        <Text style={styles.backText}>Payment methods</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : !method?.enabled ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={20} color={colors.muted} />
          <Text style={styles.noticeText}>Card payments aren’t configured yet. Add your Stripe keys to enable saving a card.</Text>
        </View>
      ) : (
        <>
          {method.has_card ? (
            <View style={styles.cardChip} testID="pm-saved-card">
              <View style={styles.cardIcon}>
                <Ionicons name="card" size={20} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardBrand}>{(method.brand || "Card").toUpperCase()} •••• {method.last4}</Text>
                <Text style={styles.cardSub}>Used for ride fares and tips</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            </View>
          ) : (
            <View style={styles.notice}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={styles.noticeText}>Add a card to start requesting rides.</Text>
            </View>
          )}

          {saved ? <Text style={styles.savedMsg}>Card saved successfully.</Text> : null}
          {error ? <Text style={styles.errorMsg}>{error}</Text> : null}

          {adding && clientSecret ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Enter card details</Text>
              <StripeCardForm clientSecret={clientSecret} onSaved={onSaved} onError={setError} />
            </View>
          ) : (
            <Button
              title={method.has_card ? "Replace card" : "Add card"}
              onPress={startAdd}
              loading={adding}
              testID="pm-add-card"
              style={{ marginTop: spacing.xl }}
            />
          )}

          <Text style={styles.help}>Test mode — use card 4242 4242 4242 4242, any future date and CVC.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xl },
  backText: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  noticeText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.onSurfaceSecondary },
  cardChip: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, ...shadowSoft },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardBrand: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface },
  cardSub: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  formCard: { marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, ...shadowSoft },
  formTitle: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.md },
  savedMsg: { fontFamily: font.semibold, fontSize: 14, color: colors.success, marginTop: spacing.lg },
  errorMsg: { fontFamily: font.medium, fontSize: 13, color: colors.error, marginTop: spacing.lg },
  help: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: spacing.xl, textAlign: "center" },
});
