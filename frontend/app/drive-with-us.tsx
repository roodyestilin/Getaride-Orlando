import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, font, radius, spacing, shadow } from "@/src/theme";

const BENEFITS: { icon: any; title: string; desc: string }[] = [
  { icon: "cash-outline", title: "Set your own fare", desc: "See every trip's details up front and accept the suggested fare or submit your own bid." },
  { icon: "airplane-outline", title: "Steady airport demand", desc: "Getaride focuses on Orlando International (MCO) transfers — consistent, higher-value rides." },
  { icon: "time-outline", title: "Drive on your schedule", desc: "Go online whenever you want. No shifts, no quotas, full flexibility." },
  { icon: "wallet-outline", title: "Keep more of your money", desc: "Transparent pricing and 100% of every tip goes straight to you." },
];

const REQUIREMENTS: string[] = [
  "Be at least 18 years old with a valid U.S. driver's license",
  "A 4-door vehicle, model year 2010 or newer, in good condition",
  "Current vehicle insurance and registration in your name",
  "Pass a background & driving-history check",
  "A smartphone to run the Getaride driver app",
];

const STEPS: { n: string; title: string; desc: string }[] = [
  { n: "1", title: "Create your account", desc: "Add your name, photo and contact info." },
  { n: "2", title: "Add your vehicle", desc: "Tell us the make, model, year and plate." },
  { n: "3", title: "Upload documents", desc: "License, insurance and registration." },
  { n: "4", title: "Get approved", desc: "We review your application, then you're ready to drive." },
];

export default function DriveWithUs() {
  const insets = useSafeAreaInsets();

  const startApplication = () => {
    Haptics.selectionAsync().catch(() => {});
    router.replace("/auth?role=driver");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <Pressable testID="dw-back" onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.heroBadge}>
            <Ionicons name="car-sport" size={16} color="#fff" />
            <Text style={styles.heroBadgeText}>Getaride Orlando</Text>
          </View>
          <Text style={styles.heroTitle}>Drive with Getaride</Text>
          <Text style={styles.heroSub}>{"Turn your car into earnings on Orlando's airport-transfer marketplace. You choose the trips and the price."}</Text>
        </View>

        <View style={styles.body}>
          {/* Why drive */}
          <Text style={styles.sectionTitle}>Why drive with Getaride?</Text>
          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={20} color={colors.brandPrimary} />
                </View>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>

          {/* Requirements */}
          <Text style={styles.sectionTitle}>{"What you'll need"}</Text>
          <View style={styles.reqCard}>
            {REQUIREMENTS.map((r) => (
              <View key={r} style={styles.reqRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.reqText}>{r}</Text>
              </View>
            ))}
          </View>

          {/* How it works */}
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.steps}>
            {STEPS.map((s) => (
              <View key={s.n} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
            <Text style={styles.noteText}>{'New drivers start as "pending" and can go online once an admin approves the application.'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="dw-start-application" onPress={startApplication} style={styles.ctaBtn}>
          <Text style={styles.ctaText}>Start your application</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
        <Pressable testID="dw-signin" onPress={() => router.replace("/auth")} hitSlop={8}>
          <Text style={styles.ctaSignin}>Already a driver? Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"], borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, marginBottom: spacing.md },
  heroBadgeText: { fontFamily: font.semibold, fontSize: 12, color: "#fff" },
  heroTitle: { fontFamily: font.bold, fontSize: 30, color: "#fff", marginBottom: spacing.sm },
  heroSub: { fontFamily: font.regular, fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 22 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionTitle: { fontFamily: font.bold, fontSize: 19, color: colors.onSurface, marginBottom: spacing.md, marginTop: spacing.lg },
  benefits: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  benefitCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  benefitTitle: { fontFamily: font.bold, fontSize: 14.5, color: colors.onSurface },
  benefitDesc: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  reqCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  reqRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  reqText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  steps: { gap: spacing.lg },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stepNum: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: font.monoBold, fontSize: 15, color: "#fff" },
  stepTitle: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  stepDesc: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, fontFamily: font.regular, fontSize: 12, color: colors.muted, lineHeight: 17 },
  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm, ...shadow },
  ctaBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { fontFamily: font.bold, fontSize: 16, color: "#fff" },
  ctaSignin: { fontFamily: font.semibold, fontSize: 13, color: colors.brandPrimary, textAlign: "center" },
});
