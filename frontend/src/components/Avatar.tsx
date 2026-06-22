import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";

export default function Avatar({ uri, size = 48 }: { uri?: string | null; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons name="person" size={size * 0.5} color={colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
});
