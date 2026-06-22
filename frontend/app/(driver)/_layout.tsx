import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, font } from "@/src/theme";

export default function DriverLayout() {
  return (
    <Tabs
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => {}) }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Drive", tabBarIcon: ({ color, size }) => <Ionicons name="car-sport" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
