import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

export default function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const res: any = await api("/driver/trips");
      setRides(res.rides);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const completed = rides.filter((r) => r.status === "completed");
  const total = completed.reduce((sum, r) => sum + (r.final_fare ?? 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Earnings</Text>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total earned</Text>
        <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        <Text style={styles.totalSub}>{completed.length} completed trips</Text>
      </View>

      <Text style={styles.section}>Trip history</Text>
      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={<Text style={styles.empty}>No trips yet. Go online to start earning!</Text>}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`dtrip-${item.id}`}>
            <View style={[styles.icon, { backgroundColor: item.status === "completed" ? "#dcfce7" : colors.surfaceSecondary }]}>
              <Ionicons name={item.status === "completed" ? "checkmark" : "time"} size={18} color={item.status === "completed" ? colors.success : colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{item.customer_name}</Text>
              <Text style={styles.cardRoute} numberOfLines={1}>{item.pickup.label} → {item.destination.label}</Text>
            </View>
            <Text style={styles.cardFare}>${(item.final_fare ?? item.recommended_fare).toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.xl },
  totalCard: { margin: spacing.xl, backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl },
  totalLabel: { fontFamily: font.medium, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  totalValue: { fontFamily: font.monoBold, fontSize: 40, color: "#fff", marginVertical: 2 },
  totalSub: { fontFamily: font.regular, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  section: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadowSoft },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardName: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  cardRoute: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  cardFare: { fontFamily: font.monoBold, fontSize: 16, color: colors.onSurface },
  empty: { fontFamily: font.regular, color: colors.muted, textAlign: "center", marginTop: spacing.xl, paddingHorizontal: spacing.xl },
});
