import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors, font, radius, spacing, shadow } from "@/src/theme";

const STEPS = [
  { icon: "location", title: "Set your route", desc: "Every trip starts or ends at Orlando International (MCO). Add your pickup and drop-off." },
  { icon: "pricetags", title: "Compare offers", desc: "Nearby drivers send you fares. You see the price, ETA, car and rating up front." },
  { icon: "car-sport", title: "Pick & ride", desc: "Choose the driver that works for you, track them live, and pay securely in-app." },
];

const FEATURES = [
  { icon: "cash-outline", title: "You choose the price", desc: "Unlike other apps, drivers bid on your trip. Compare and pick the offer that fits your budget." },
  { icon: "airplane-outline", title: "Airport specialists", desc: "Built for MCO transfers — flight, terminal and baggage details baked right into every booking." },
  { icon: "shield-checkmark-outline", title: "Transparent & secure", desc: "No surprise surge. Your card is only charged when you accept an offer." },
  { icon: "star-outline", title: "Vetted drivers", desc: "Every driver is reviewed and approved before they can accept a single ride." },
];

function PrimaryBtn({ label, onPress, testID, light }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.btn, light ? styles.btnLight : styles.btnPrimary]}>
      <Text style={[styles.btnText, light ? styles.btnTextDark : styles.btnTextLight]}>{label}</Text>
    </Pressable>
  );
}

export default function DesktopLanding() {
  return (
    <View>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.container}>
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <Text style={styles.eyebrow}>ORLANDO · MCO AIRPORT TRANSFERS</Text>
              <Text style={styles.h1}>Your airport ride, your price.</Text>
              <Text style={styles.heroSub}>
                {"Getaride is Orlando's ride marketplace. Drivers send you offers — you compare fares, ETAs and ratings, then pick the one you like. No surge, no guessing."}
              </Text>
              <View style={styles.heroBtns}>
                <PrimaryBtn testID="hero-getaride" label="Get a ride" onPress={() => router.push("/(customer)")} />
                <PrimaryBtn testID="hero-drive" label="Become a driver" light onPress={() => router.push("/drive-with-us")} />
              </View>
            </View>

            {/* Booking preview card */}
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Compare driver offers</Text>
              <View style={styles.routeBox}>
                <Ionicons name="airplane" size={16} color={colors.brandPrimary} />
                <Text style={styles.routeText}>Orlando Intl (MCO)</Text>
              </View>
              <View style={styles.routeBox}>
                <Ionicons name="location" size={16} color={colors.brandPrimary} />
                <Text style={styles.routeText}>Disney Springs, Orlando</Text>
              </View>
              {[
                { name: "Marcus B.", car: "White Tesla Model 3", rating: "4.9", eta: "4 min", fare: "38.00" },
                { name: "Aisha R.", car: "Silver Toyota Camry", rating: "4.8", eta: "6 min", fare: "34.50" },
                { name: "Liam W.", car: "Gray Ford Escape", rating: "4.6", eta: "3 min", fare: "41.00" },
              ].map((o) => (
                <View key={o.name} style={styles.offerRow}>
                  <View style={styles.offerAvatar}><Ionicons name="person" size={18} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offerName}>{o.name}</Text>
                    <Text style={styles.offerMeta}>★ {o.rating} · {o.eta} · {o.car}</Text>
                  </View>
                  <Text style={styles.offerFare}>${o.fare}</Text>
                </View>
              ))}
              <Text style={styles.previewNote}>Preview — start a real booking anytime.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <View style={styles.container}>
          <Text style={styles.h2}>How Getaride works</Text>
          <View style={styles.cardsRow}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.stepCard}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{i + 1}</Text></View>
                <View style={styles.stepIcon}><Ionicons name={s.icon as any} size={22} color={colors.brandPrimary} /></View>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardDesc}>{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Why riders */}
      <View style={[styles.section, styles.sectionAlt]}>
        <View style={styles.container}>
          <Text style={styles.h2}>Why riders choose Getaride</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIcon}><Ionicons name={f.icon as any} size={22} color={colors.brandPrimary} /></View>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Drive band */}
      <View style={styles.driveBand}>
        <View style={styles.container}>
          <View style={styles.driveRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.driveTitle}>Shift into earnings mode</Text>
              <Text style={styles.driveSub}>{"Set your own fares, drive Orlando's steady airport demand, and keep 100% of every tip. Apply in minutes."}</Text>
            </View>
            <PrimaryBtn testID="drive-band-cta" label="Apply to drive" light onPress={() => router.push("/drive-with-us")} />
          </View>
        </View>
      </View>

      {/* Final CTA */}
      <View style={styles.section}>
        <View style={styles.container}>
          <View style={styles.finalCta}>
            <Text style={styles.h2}>Ready when you are</Text>
            <Text style={styles.finalSub}>Book your next Orlando airport ride and let drivers compete for your fare.</Text>
            <PrimaryBtn testID="final-getaride" label="Get a ride" onPress={() => router.push("/(customer)")} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32 },
  hero: { backgroundColor: colors.brandTertiary, paddingVertical: spacing["3xl"] },
  heroRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing["3xl"], justifyContent: "space-between" },
  heroLeft: { flexBasis: 480, flexGrow: 1, gap: spacing.lg },
  eyebrow: { fontFamily: font.bold, fontSize: 13, letterSpacing: 1, color: colors.brandPrimary },
  h1: { fontFamily: font.bold, fontSize: 52, lineHeight: 56, color: colors.onSurface },
  heroSub: { fontFamily: font.regular, fontSize: 18, lineHeight: 27, color: colors.onSurfaceSecondary, maxWidth: 520 },
  heroBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  btn: { height: 52, borderRadius: radius.pill, paddingHorizontal: spacing["2xl"], alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnLight: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong },
  btnText: { fontFamily: font.bold, fontSize: 16 },
  btnTextLight: { color: "#fff" },
  btnTextDark: { color: colors.onSurface },
  previewCard: { flexBasis: 380, flexGrow: 0, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, ...shadow },
  previewTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface, marginBottom: spacing.xs },
  routeBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  routeText: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  offerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs },
  offerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  offerName: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface },
  offerMeta: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  offerFare: { fontFamily: font.monoBold, fontSize: 18, color: colors.onSurface },
  previewNote: { fontFamily: font.regular, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.xs },
  section: { paddingVertical: spacing["3xl"] },
  sectionAlt: { backgroundColor: colors.surfaceSecondary },
  h2: { fontFamily: font.bold, fontSize: 34, color: colors.onSurface, textAlign: "center", marginBottom: spacing["2xl"] },
  cardsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, justifyContent: "center" },
  stepCard: { flexBasis: 320, flexGrow: 1, maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  stepBadge: { position: "absolute", top: spacing.lg, right: spacing.lg, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontFamily: font.monoBold, fontSize: 14, color: "#fff" },
  stepIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  cardTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  cardDesc: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, color: colors.muted },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, justifyContent: "center" },
  featureCard: { flexBasis: 380, flexGrow: 1, maxWidth: 440, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, ...shadow },
  featureIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  driveBand: { backgroundColor: colors.brandPrimary, paddingVertical: spacing["2xl"] },
  driveRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xl, justifyContent: "space-between" },
  driveTitle: { fontFamily: font.bold, fontSize: 30, color: "#fff" },
  driveSub: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.9)", marginTop: spacing.sm, maxWidth: 620 },
  finalCta: { alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl },
  finalSub: { fontFamily: font.regular, fontSize: 17, color: colors.onSurfaceSecondary, textAlign: "center", maxWidth: 560, marginBottom: spacing.sm, marginTop: -spacing.md },
});
