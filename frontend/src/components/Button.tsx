import React from "react";
import { Text, Pressable, StyleSheet, ActivityIndicator, ViewStyle, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, font, radius, spacing } from "@/src/theme";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  icon?: React.ReactNode;
};

export default function Button({ title, onPress, variant = "primary", loading, disabled, style, testID, icon }: Props) {
  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isSecondary = variant === "secondary";
  const bg = isPrimary ? colors.brandPrimary : isDanger ? colors.error : isSecondary ? colors.surfaceSecondary : "transparent";
  const fg = isPrimary || isDanger ? "#fff" : isSecondary ? colors.onSurface : colors.brandPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && styles.ghost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text style={[styles.text, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  ghost: { height: 44 },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontFamily: font.semibold, fontSize: 16 },
});
