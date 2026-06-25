import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, font, radius, shadow, shadowSoft, spacing } from "@/src/theme";

type Period = "today" | "week" | "month";

export default function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState<Period>("week");

  const load = useCallback(async () => {
    try {
      const res: any = await api("/driver/earnings");
      setData(res);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days: any[] = data?.days || [];
  const maxDay = Math.max(1, ...days.map((d) => d.amount));
  const trips: any[] = data?.trips || [];

  const total = period === "today" ? data?.today_total : period === "month" ? data?.month_total : data?.week_total;
  const tripCount = period === "today" ? data?.today_trips : period === "month" ? data?.month_trips : data?.week_trips;
  const periodLabel = period === "today" ? "Today" : period === "month" ? "This month" : "This week";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 80 }}>
      <Text style={styles.title}>Earnings</Text>

      <View style={styles.segment}>
        {(["today", "week", "month"] as const).map((p) => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.segBtn, period === p && styles.segBtnActive]} testID={`period-${p}`}>
            <Text style={[styles.segText, period === p && styles.segTextActive]}>{p === "today" ? "Day" : p[0].toUpperCase() + p.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.weekCard}>
        <Text style={styles.weekLabel}>{periodLabel} · {tripCount ?? 0} trips</Text>
        <Text style={styles.weekValue}>${(total ?? 0).toFixed(2)}</Text>
        <View style={styles.chartRow}>
          {days.map((d, i) => (
            <View key={i} style={styles.chartCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.round((d.amount / maxDay) * 100)}%` }]} />
              </View>
              <Text style={styles.barLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.chartHint}>This week&apos;s daily earnings</Text>
      </View>

      <View style={styles.statRow}>
        <Stat icon="time-outline" value={`${data?.online_hours ?? 0}h`} label="Online" />
        <Stat icon="car-sport-outline" value={`${data?.week_trips ?? 0}`} label="Wk trips" />
        <Stat icon="sparkles-outline" value={`${data?.points ?? 0}`} label="Points" />
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletTop}>
          <View style={styles.walletIcon}><Ionicons name="wallet" size={20} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletLabel}>Wallet balance</Text>
            <Text style={styles.walletValue}>${(data?.lifetime ?? 0).toFixed(2)}</Text>
          </View>
        </View>
        <Text style={styles.walletSub}>Your lifetime trip earnings, including tips.</Text>
      </View>

      <Text style={styles.section}>Fare breakdown</Text>
      {trips.length === 0 ? (
        <Text style={styles.empty}>No completed trips yet. Go online to start earning!</Text>
      ) : (
        trips.map((t) => (
          <View key={t.id} style={styles.tripCard} testID={`earn-${t.id}`}>
            <View style={styles.tripHead}>
              <Text style={styles.tripName} numberOfLines={1}>{t.customer_name || "Rider"}</Text>
              <Text style={styles.tripTotal}>${t.total.toFixed(2)}</Text>
            </View>
            <Text style={styles.tripRoute} numberOfLines={1}>{t.pickup} → {t.destination}</Text>
            <View style={styles.tripLines}>
              <View style={styles.tripLine}>
                <Text style={styles.tripLineLabel}>Trip fare{t.distance_miles ? ` · ${t.distance_miles} mi` : ""}</Text>
                <Text style={styles.tripLineVal}>${t.fare.toFixed(2)}</Text>
              </View>
              <View style={styles.tripLine}>
                <Text style={styles.tripLineLabel}>Tip (100% yours)</Text>
                <Text style={[styles.tripLineVal, t.tip > 0 && { color: colors.success }]}>${t.tip.toFixed(2)}</Text>
              </View>
              <View style={[styles.tripLine, styles.tripLineTotal]}>
                <Text style={styles.tripLineLabelBold}>You earned</Text>
                <Text style={styles.tripLineValBold}>${t.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ icon, value, label }: any) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  segment: { flexDirection: "row", marginHorizontal: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  segBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm },
  segBtnActive: { backgroundColor: colors.surface, ...shadowSoft },
  segText: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  segTextActive: { color: colors.brandPrimary, fontFamily: font.semibold },
  weekCard: { marginHorizontal: spacing.xl, backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, ...shadow },
  weekLabel: { fontFamily: font.medium, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  weekValue: { fontFamily: font.monoBold, fontSize: 38, color: "#fff", marginTop: 2 },
  chartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.lg, height: 96 },
  chartCol: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { width: 14, height: 70, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.22)", justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 7, backgroundColor: "#fff", minHeight: 4 },
  barLabel: { fontFamily: font.medium, fontSize: 11, color: "rgba(255,255,255,0.85)" },
  chartHint: { fontFamily: font.regular, fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: spacing.sm, textAlign: "center" },
  statRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", gap: 4, ...shadowSoft },
  statValue: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  statLabel: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  walletCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadowSoft },
  walletTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  walletIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  walletLabel: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  walletValue: { fontFamily: font.monoBold, fontSize: 24, color: colors.onSurface },
  walletSub: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: spacing.sm },
  section: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { fontFamily: font.regular, color: colors.muted, textAlign: "center", paddingHorizontal: spacing.xl },
  tripCard: { marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tripHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tripName: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  tripTotal: { fontFamily: font.monoBold, fontSize: 16, color: colors.brandPrimary },
  tripRoute: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  tripLines: { gap: spacing.sm },
  tripLine: { flexDirection: "row", justifyContent: "space-between" },
  tripLineLabel: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  tripLineVal: { fontFamily: font.medium, fontSize: 13, color: colors.onSurface },
  tripLineTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 2 },
  tripLineLabelBold: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface },
  tripLineValBold: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface },
});
