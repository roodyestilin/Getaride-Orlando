import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { useAuth } from "@/src/auth";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing["2xl"], paddingHorizontal: spacing.xl, alignItems: "center" }]}>
        <View style={styles.guestIcon}>
          <Ionicons name="person-circle-outline" size={64} color={colors.brandPrimary} />
        </View>
        <Text style={styles.guestTitle}>You're browsing as a guest</Text>
        <Text style={styles.guestSub}>Sign in or create an account to manage your trips, payment methods, and messages.</Text>
        <Button title="Sign in / Create account" onPress={() => router.push("/auth")} testID="guest-signin" style={{ marginTop: spacing.xl, alignSelf: "stretch" }} />
      </View>
    );
  }

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

      {user.role === "customer" ? (
        <Pressable testID="account-payment-methods" onPress={() => router.push("/payment-methods")} style={styles.linkRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="card" size={18} color={colors.brandPrimary} />
          </View>
          <Text style={styles.linkLabel}>Payment methods</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ) : null}

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
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 60, marginTop: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadowSoft },
  linkLabel: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  guestIcon: { marginTop: spacing["2xl"], marginBottom: spacing.md },
  guestTitle: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  guestSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  version: { textAlign: "center", marginTop: spacing.xl, fontFamily: font.regular, fontSize: 12, color: colors.muted },
});
