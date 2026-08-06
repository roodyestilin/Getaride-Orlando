import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";

import Logo from "@/src/components/Logo";
import { useAuth } from "@/src/auth";
import { colors, font, radius, spacing } from "@/src/theme";

const NAV = [
  { key: "ride", label: "Ride", href: "/(customer)" },
  { key: "riders", label: "For Riders", href: "/riders" },
  { key: "drivers", label: "For Drivers", href: "/drive-with-us" },
];

const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Riders",
    links: [
      { label: "Get a ride", href: "/(customer)" },
      { label: "For riders", href: "/riders" },
      { label: "Airport transfers", href: "/riders" },
    ],
  },
  {
    title: "Drivers",
    links: [
      { label: "Become a driver", href: "/drive-with-us" },
      { label: "Requirements", href: "/drive-with-us" },
      { label: "Sign in", href: "/auth" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Orlando (MCO)", href: "/riders" },
      { label: "Safety", href: "/riders" },
      { label: "Log in", href: "/auth" },
    ],
  },
];

export default function DesktopChrome({ active, children }: { active?: string; children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <View style={styles.navInner}>
          <Logo size={30} showWord showMark={false} />
          <View style={styles.navLinks}>
            {NAV.map((n) => (
              <Pressable key={n.key} testID={`dnav-${n.key}`} onPress={() => router.push(n.href as any)}>
                <Text style={[styles.navLink, active === n.key && styles.navLinkActive]}>{n.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.navRight}>
            {user ? (
              <Pressable testID="dnav-account" onPress={() => router.push(user.role === "driver" ? "/(driver)" : "/(customer)")}>
                <Text style={styles.navLink}>Open app</Text>
              </Pressable>
            ) : (
              <Pressable testID="dnav-login" onPress={() => router.push("/auth")}>
                <Text style={styles.navLink}>Log in</Text>
              </Pressable>
            )}
            <Pressable testID="dnav-getaride" onPress={() => router.push("/(customer)")} style={styles.navCta}>
              <Text style={styles.navCtaText}>Get a ride</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
        {children}
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <View style={styles.footerBrand}>
              <Logo size={30} showWord showMark={false} />
              <Text style={styles.footerTag}>{"Orlando's airport-transfer ride marketplace. Compare driver offers, pick your price."}</Text>
            </View>
            <View style={styles.footerCols}>
              {FOOTER_COLS.map((c) => (
                <View key={c.title} style={styles.footerCol}>
                  <Text style={styles.footerColTitle}>{c.title}</Text>
                  {c.links.map((l) => (
                    <Pressable key={l.label} onPress={() => router.push(l.href as any)}>
                      <Text style={styles.footerLink}>{l.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          </View>
          <View style={styles.footerBar}>
            <Text style={styles.footerCopy}>© 2026 Getaride Orlando · Web app</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  nav: { height: 72, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, justifyContent: "center", zIndex: 10 },
  navInner: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32, flexDirection: "row", alignItems: "center", gap: spacing.xl },
  navLinks: { flexDirection: "row", alignItems: "center", gap: spacing.xl, flex: 1 },
  navLink: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurfaceSecondary },
  navLinkActive: { color: colors.brandPrimary },
  navRight: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  navCta: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.xl, height: 44, alignItems: "center", justifyContent: "center" },
  navCtaText: { fontFamily: font.bold, fontSize: 15, color: "#fff" },
  scroll: { flexGrow: 1 },
  footer: { backgroundColor: colors.onSurface, paddingTop: spacing["3xl"] },
  footerInner: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32, flexDirection: "row", flexWrap: "wrap", gap: spacing["3xl"], justifyContent: "space-between", paddingBottom: spacing["2xl"] },
  footerBrand: { maxWidth: 340, gap: spacing.md },
  footerTag: { fontFamily: font.regular, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 21 },
  footerCols: { flexDirection: "row", gap: spacing["3xl"] },
  footerCol: { gap: spacing.md },
  footerColTitle: { fontFamily: font.bold, fontSize: 14, color: "#fff", marginBottom: 2 },
  footerLink: { fontFamily: font.regular, fontSize: 14, color: "rgba(255,255,255,0.7)" },
  footerBar: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", marginTop: spacing.lg },
  footerCopy: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32, paddingVertical: spacing.lg, fontFamily: font.regular, fontSize: 13, color: "rgba(255,255,255,0.5)" },
});
