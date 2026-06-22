import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, font } from "@/src/theme";

export default function Logo({ size = 44, showWord = false }: { size?: number; showWord?: boolean }) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.box,
          { width: size, height: size, borderRadius: size * 0.28 },
        ]}
      >
        <Text style={[styles.g, { fontSize: size * 0.62, lineHeight: size * 0.78 }]}>g</Text>
      </View>
      {showWord ? (
        <Text style={styles.word}>
          Getaride <Text style={styles.wordCity}>Orlando</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  box: {
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  g: {
    color: "#fff",
    fontFamily: font.bold,
    fontWeight: "800",
  },
  word: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  wordCity: { color: colors.brandPrimary },
});
