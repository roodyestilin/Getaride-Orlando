import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, font } from "@/src/theme";

const MARK = require("@/assets/images/logo-g.png");

export default function Logo({
  size = 44,
  showWord = false,
  showMark = true,
  link = true,
}: {
  size?: number;
  showWord?: boolean;
  showMark?: boolean;
  link?: boolean;
}) {
  const content = (
    <View style={styles.row}>
      {showMark ? (
        <Image
          source={MARK}
          style={{ width: size, height: size, borderRadius: size * 0.28 }}
          resizeMode="contain"
        />
      ) : null}
      {showWord ? (
        <Text style={styles.word}>
          Getaride <Text style={styles.wordCity}>Orlando</Text>
        </Text>
      ) : null}
    </View>
  );

  if (!link) return content;
  return (
    <Pressable
      testID="logo-home"
      onPress={() => router.push("/")}
      accessibilityRole="link"
      accessibilityLabel="Go to home"
      hitSlop={6}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  word: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  wordCity: { color: colors.brandPrimary },
});
