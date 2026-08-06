import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors, font, radius, spacing, shadow } from "@/src/theme";

const BENEFITS = [
  { icon: "pricetags-outline", title: "Compare real offers", desc: "See fares, ETAs, cars and ratings from multiple drivers, then pick your favorite." },
  { icon: "airplane-outline", title: "Made for MCO", desc: "Add your airline, terminal, flight and bags so your driver is ready at the curb." },
  { icon: "card-outline", title: "No surprise charges", desc: "Your card is authorized only when you accept an offer, captured after drop-off." },
  { icon: "navigate-outline", title: "Live tracking", desc: "Watch your driver approach in real time and chat right inside the app." },
];

const STEPS = [
  { title: "Enter your trip", desc: "Set pickup and drop-off — one end is always Orlando International (MCO)." },
  { title: "Review offers", desc: "Drivers send competing fares within seconds. Sort by price, ETA or rating." },
  { title: "Ride & pay", desc: "Track your driver live, arrive, and pay securely. Tip in the app if you like." },
];

function PrimaryBtn({ label, onPress, testID, light }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.btn, light ? styles.btnLight : styles.btnPrimary]}>
      <Text style={[styles.btnText, light ? styles.btnTextDark : styles.btnTextLight]}>{label}</Text>
    </Pressable>
  );
}

export default function DesktopRiders() {
  return (
    <View>
      <View style={styles.hero}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>FOR RIDERS</Text>
          <Text style={styles.h1}>Airport rides that put you in control.</Text>
          <Text style={styles.heroSub}>Drivers compete for your trip to and from Orlando International. You compare and choose — every time.</Text>
          <View style={styles.heroBtns}>
            <PrimaryBtn testID="riders-getaride" label="Get a ride" onPress={() => router.push("/(customer)")} />
            <PrimaryBtn testID="riders-signin" label="Sign in" light onPress={() => router.push("/auth")} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.container}>
          <Text style={styles.h2}>Why ride with Getaride</Text>
          <View style={styles.grid}>
            {BENEFITS.map((b) => (
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
          <Text style={styles.h2}>How to ride</Text>
          <View style={styles.grid}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.stepCard}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{i + 1}</Text></View>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardDesc}>{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.container}>
          <View style={styles.finalCta}>
            <Ionicons name="airplane" size={30} color={colors.brandPrimary} />
            <Text style={styles.h2}>Flying in or out of MCO?</Text>
            <Text style={styles.finalSub}>{"Book now and let Orlando's drivers send you their best fare."}</Text>
            <PrimaryBtn testID="riders-final-cta" label="Get a ride" onPress={() => router.push("/(customer)")} />
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
  h1: { fontFamily: font.bold, fontSize: 46, lineHeight: 52, color: colors.onSurface, textAlign: "center", marginTop: spacing.md, maxWidth: 760, alignSelf: "center" },
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, justifyContent: "center" },
  card: { flexBasis: 380, flexGrow: 1, maxWidth: 440, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, ...shadow },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  stepCard: { flexBasis: 320, flexGrow: 1, maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  stepBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  stepBadgeText: { fontFamily: font.monoBold, fontSize: 15, color: "#fff" },
  cardTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  cardDesc: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, color: colors.muted },
  finalCta: { alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl },
  finalSub: { fontFamily: font.regular, fontSize: 17, color: colors.onSurfaceSecondary, textAlign: "center", maxWidth: 560, marginTop: -spacing.sm, marginBottom: spacing.sm },
});
