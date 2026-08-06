import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

const HERO_IMG = require("@/assets/images/guest-hero.png");
const LOGO_MARK = require("@/assets/images/logo-g.png");

function memberDuration(createdAtSec?: number): string {  if (!createdAtSec) return "New";
  const months = Math.floor((Date.now() / 1000 - createdAtSec) / (30 * 24 * 3600));
  if (months < 1) return "New";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 yr" : `${years} yrs`;
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ total_rides: number; rating: number; created_at?: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    api("/me/profile")
      .then((p: any) => setProfile({ total_rides: p.total_rides, rating: p.rating, created_at: p.created_at }))
      .catch(() => {});
  }, [user]);

  if (!user) {
    const heroW = winW - spacing.lg * 2;
    const heroH = heroW / (1486 / 1058);
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }}>
          <View style={styles.guestCard}>
            <Image source={HERO_IMG} style={[styles.guestCardImg, { height: heroH }]} resizeMode="cover" />
            <View style={styles.guestCaption}>
              <View style={styles.guestHeroIcon}>
                <Image source={LOGO_MARK} style={styles.guestHeroLogo} resizeMode="contain" />
              </View>
              <Text style={styles.guestHeroTitle}>Need a ride? We got you!</Text>
              <Text style={styles.guestHeroSub}>
                Sign in to compare driver offers, book Orlando airport transfers, and manage your trips.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.guestBody}>
          {[
            { icon: "pricetags", title: "Compare & pick your price", desc: "Drivers send you fares — you choose the best offer." },
            { icon: "airplane", title: "Orlando airport transfers", desc: "Fast, reliable rides to and from MCO." },
            { icon: "shield-checkmark", title: "Track live & pay securely", desc: "Real-time tracking with card-on-file payments." },
          ].map((f) => (
            <View key={f.title} style={styles.guestFeature}>
              <View style={styles.guestFeatureIcon}>
                <Ionicons name={f.icon as any} size={20} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestFeatureTitle}>{f.title}</Text>
                <Text style={styles.guestFeatureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}

          <Button
            title="Sign in / Create account"
            onPress={() => router.push("/auth")}
            testID="guest-signin"
            style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
          />
          <Pressable testID="guest-become-driver" onPress={() => router.push("/drive-with-us")} style={styles.guestDriverLink}>
            <Text style={styles.guestDriverText}>
              Want to drive with Getaride? <Text style={styles.guestDriverLinkText}>Apply here</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const rows = [
    { icon: "mail", label: "Email", value: user.email },
    { icon: "call", label: "Phone", value: user.phone || "—" },
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
        <Text style={styles.roleTag}>{user.role === "driver" ? "Getaride Driver" : "Getaride Rider"}</Text>
      </View>

      <View style={styles.statsRow} testID="profile-stats">
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{profile ? profile.total_rides : "—"}</Text>
          <Text style={styles.statLabel}>Rides</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statCell}>
          <View style={styles.statValueRow}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.statValue}>{(profile?.rating ?? user.rating ?? 5).toFixed(1)}</Text>
          </View>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{memberDuration(profile?.created_at ?? user.created_at)}</Text>
          <Text style={styles.statLabel}>On Getaride</Text>
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
        <>
          <Pressable testID="account-edit-profile" onPress={() => router.push("/edit-profile")} style={styles.linkRow}>
            <View style={styles.rowIcon}>
              <Ionicons name="person" size={18} color={colors.brandPrimary} />
            </View>
            <Text style={styles.linkLabel}>Edit profile</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
          <Pressable testID="account-payment-methods" onPress={() => router.push("/payment-methods")} style={styles.linkRow}>
            <View style={styles.rowIcon}>
              <Ionicons name="card" size={18} color={colors.brandPrimary} />
            </View>
            <Text style={styles.linkLabel}>Payment methods</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </>
      ) : null}

      <Button title="Sign Out" variant="secondary" onPress={signOut} testID="sign-out" style={{ marginTop: spacing.xl }} />
      <Text style={styles.version}>Getaride Orlando · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  head: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.lg },
  name: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface },
  roleTag: { fontFamily: font.medium, fontSize: 13, color: colors.brandPrimary },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadowSoft, paddingVertical: spacing.lg, marginBottom: spacing.lg },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  statLabel: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  statSep: { width: 1, height: 34, backgroundColor: colors.border },
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
  guestCard: { borderRadius: 24, overflow: "hidden", backgroundColor: colors.brandPrimary, ...shadowSoft },
  guestCardImg: { width: "100%" },
  guestCaption: { backgroundColor: colors.brandPrimary, alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing["2xl"] },
  guestHeroIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginTop: -50, marginBottom: spacing.md, ...shadowSoft },
  guestHeroLogo: { width: 42, height: 42, borderRadius: 11 },
  guestHeroTitle: { fontFamily: font.bold, fontSize: 25, color: "#fff", textAlign: "center" },
  guestHeroSub: { fontFamily: font.regular, fontSize: 14, color: "rgba(255,255,255,0.92)", textAlign: "center", marginTop: spacing.sm, lineHeight: 20, maxWidth: 320 },
  guestBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  guestFeature: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  guestFeatureIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  guestFeatureTitle: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  guestFeatureDesc: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  guestDriverLink: { alignItems: "center", paddingVertical: spacing.md },
  guestDriverText: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  guestDriverLinkText: { fontFamily: font.bold, color: colors.brandPrimary },
  version: { textAlign: "center", marginTop: spacing.xl, fontFamily: font.regular, fontSize: 12, color: colors.muted },
});
