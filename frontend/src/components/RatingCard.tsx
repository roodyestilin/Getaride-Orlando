import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { colors, font, radius, spacing } from "@/src/theme";

type Props = {
  rideId: string;
  targetName?: string;
  targetLabel: string; // "driver" | "rider"
  onDone?: () => void;
};

export default function RatingCard({ rideId, targetName, targetLabel, onDone }: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (stars < 1) return;
    setBusy(true);
    setErr(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await api(`/rides/${rideId}/rate`, { method: "POST", body: { rating: stars, comment: comment.trim() || undefined } });
      setDone(true);
      onDone?.();
    } catch (e: any) {
      setErr(e?.message || "Couldn't submit your rating. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={styles.doneCard} testID="rating-done">
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        <Text style={styles.thanks}>Thanks for rating {targetName || `your ${targetLabel}`}!</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="rating-card">
      <Text style={styles.title}>Rate {targetName || `your ${targetLabel}`}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} testID={`rate-star-${n}`} onPress={() => { setStars(n); Haptics.selectionAsync().catch(() => {}); }} hitSlop={6}>
            <Ionicons name={n <= stars ? "star" : "star-outline"} size={36} color={n <= stars ? colors.warning : colors.surfaceTertiary} />
          </Pressable>
        ))}
      </View>
      <TextInput
        testID="rate-comment"
        value={comment}
        onChangeText={setComment}
        placeholder={`Add a note about your ${targetLabel} (optional)`}
        placeholderTextColor={colors.muted}
        style={styles.input}
        multiline
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable
        testID="rate-submit"
        onPress={submit}
        disabled={stars < 1 || busy}
        style={[styles.btn, (stars < 1 || busy) && { opacity: 0.5 }]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit rating</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface, textAlign: "center" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  input: { minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: font.regular, fontSize: 14, color: colors.onSurface },
  err: { fontFamily: font.medium, fontSize: 12, color: colors.error, textAlign: "center" },
  btn: { height: 50, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: font.bold, fontSize: 15, color: "#fff" },
  doneCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  thanks: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
});
