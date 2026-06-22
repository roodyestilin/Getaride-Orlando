import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { useAuth } from "@/src/auth";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  if (!user) return null;

  const rows = [
    { icon: "mail", label: "Email", value: user.email },
    { icon: "shield-checkmark", label: "Account type", value: user.role === "driver" ? "Driver" : "Rider" },
    ...(user.role === "driver"
      ? [
          { icon: "car", label: "Vehicle", value: user.vehicle || "—" },
          { icon: "pricetag", label: "Plate", value: user.plate || "—" },
        ]
      : []),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing["2xl"], paddingHorizontal: spacing.xl }}>
      <View style={styles.head}>
        <Avatar uri={user.photo} size={84} />
        <Text style={styles.name}>{user.name}</Text>
        <View style={styles.ratingPill}>
          <Ionicons name="star" size={14} color={colors.warning} />
          <Text style={styles.ratingText}>{(user.rating ?? 5).toFixed(1)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.label}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={r.icon as any} size={18} color={colors.brandPrimary} />
              </View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Button title="Sign Out" variant="secondary" onPress={signOut} testID="sign-out" style={{ marginTop: spacing.xl }} />
      <Text style={styles.version}>Getaride Orlando · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  head: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  name: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  ratingText: { fontFamily: font.monoBold, fontSize: 13, color: colors.onSurface },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadowSoft, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: font.medium, fontSize: 14, color: colors.onSurfaceSecondary },
  rowValue: { flex: 1, textAlign: "right", fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.border },
  version: { textAlign: "center", marginTop: spacing.xl, fontFamily: font.regular, fontSize: 12, color: colors.muted },
});
