import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors, font, radius, spacing, shadow } from "@/src/theme";

const EARN = [
  { icon: "cash-outline", title: "Set your own fare", desc: "Accept the suggested price or submit your own bid on every trip you want." },
  { icon: "airplane-outline", title: "Steady airport demand", desc: "Orlando International (MCO) transfers mean consistent, higher-value rides." },
  { icon: "time-outline", title: "Total flexibility", desc: "Go online whenever you want. No shifts, no quotas, no minimums." },
  { icon: "wallet-outline", title: "Keep 100% of tips", desc: "Transparent pricing and every tip goes straight to you." },
];

const REQUIREMENTS = [
  "Be at least 18 with a valid U.S. driver's license",
  "A 4-door vehicle, model year 2010 or newer",
  "Current insurance and registration in your name",
  "Pass a background & driving-history check",
  "A smartphone to run the Getaride driver app",
];

const STEPS = [
  { title: "Create your account", desc: "Add your name, photo and contact info." },
  { title: "Add your vehicle", desc: "Make, model, year and plate." },
  { title: "Upload documents", desc: "License, insurance and registration." },
  { title: "Get approved", desc: "We review, then you're ready to drive." },
];

function PrimaryBtn({ label, onPress, testID, light }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.btn, light ? styles.btnLight : styles.btnPrimary]}>
      <Text style={[styles.btnText, light ? styles.btnTextDark : styles.btnTextLight]}>{label}</Text>
    </Pressable>
  );
}

export default function DesktopDrivers() {
  const apply = () => router.push("/auth?role=driver");
  return (
    <View>
      <View style={styles.hero}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>FOR DRIVERS</Text>
          <Text style={styles.h1}>Shift into earnings mode.</Text>
          <Text style={styles.heroSub}>{"Turn your car into income on Orlando's airport-transfer marketplace. You choose the trips and the price."}</Text>
          <View style={styles.heroBtns}>
            <PrimaryBtn testID="drivers-apply" label="Start your application" onPress={apply} />
            <PrimaryBtn testID="drivers-signin" label="Sign in" light onPress={() => router.push("/auth")} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.container}>
          <Text style={styles.h2}>Why drive with Getaride</Text>
          <View style={styles.grid}>
            {EARN.map((b) => (
              <View key={b.title} style={styles.card}>
                <View style={styles.icon}><Ionicons name={b.icon as any} size={22} color={colors.brandPrimary} /></View>
                <Text style={styles.cardTitle}>{b.title}</Text>
                <Text style={styles.cardDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.sectionAlt]}>
        <View style={styles.container}>
          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <Text style={styles.h2Left}>{"What you'll need"}</Text>
              <View style={styles.reqCard}>
                {REQUIREMENTS.map((r) => (
                  <View key={r} style={styles.reqRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.reqText}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.h2Left}>How it works</Text>
              <View style={{ gap: spacing.lg }}>
                {STEPS.map((s, i) => (
                  <View key={s.title} style={styles.stepRow}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      <Text style={styles.cardDesc}>{s.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.driveBand}>
        <View style={styles.container}>
          <View style={styles.driveRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.driveTitle}>Apply in minutes</Text>
              <Text style={styles.driveSub}>New drivers are reviewed and approved before going online. Start your application today.</Text>
            </View>
            <PrimaryBtn testID="drivers-band-cta" label="Start your application" light onPress={apply} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32 },
  hero: { backgroundColor: colors.brandTertiary, paddingVertical: spacing["3xl"], alignItems: "center" },
  eyebrow: { fontFamily: font.bold, fontSize: 13, letterSpacing: 1, color: colors.brandPrimary, textAlign: "center" },
  h1: { fontFamily: font.bold, fontSize: 46, lineHeight: 52, color: colors.onSurface, textAlign: "center", marginTop: spacing.md },
  heroSub: { fontFamily: font.regular, fontSize: 18, lineHeight: 27, color: colors.onSurfaceSecondary, textAlign: "center", maxWidth: 620, alignSelf: "center", marginTop: spacing.md },
  heroBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, justifyContent: "center" },
  btn: { height: 52, borderRadius: radius.pill, paddingHorizontal: spacing["2xl"], alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnLight: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong },
  btnText: { fontFamily: font.bold, fontSize: 16 },
  btnTextLight: { color: "#fff" },
  btnTextDark: { color: colors.onSurface },
  section: { paddingVertical: spacing["3xl"] },
  sectionAlt: { backgroundColor: colors.surfaceSecondary },
  h2: { fontFamily: font.bold, fontSize: 34, color: colors.onSurface, textAlign: "center", marginBottom: spacing["2xl"] },
  h2Left: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, justifyContent: "center" },
  card: { flexBasis: 260, flexGrow: 1, maxWidth: 300, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, ...shadow },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  cardTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  cardDesc: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  twoCol: { flexDirection: "row", flexWrap: "wrap", gap: spacing["3xl"] },
  colHalf: { flexBasis: 420, flexGrow: 1 },
  reqCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, ...shadow },
  reqRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  reqText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stepBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontFamily: font.monoBold, fontSize: 15, color: "#fff" },
  driveBand: { backgroundColor: colors.brandPrimary, paddingVertical: spacing["2xl"] },
  driveRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xl, justifyContent: "space-between" },
  driveTitle: { fontFamily: font.bold, fontSize: 30, color: "#fff" },
  driveSub: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.9)", marginTop: spacing.sm, maxWidth: 620 },
});
