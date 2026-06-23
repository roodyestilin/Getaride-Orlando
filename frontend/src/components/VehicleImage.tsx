import React, { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors } from "@/src/theme";

// In-memory cache so the same vehicle description isn't refetched on every poll.
const cache: Record<string, string | null> = {};

export default function VehicleImage({
  desc,
  width = 92,
  height = 60,
  rounded = 12,
  testID,
}: {
  desc?: string;
  width?: number;
  height?: number;
  rounded?: number;
  testID?: string;
}) {
  const key = (desc || "").trim().toLowerCase();
  const [uri, setUri] = useState<string | null>(key ? cache[key] ?? null : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key) return;
    if (cache[key] !== undefined) {
      setUri(cache[key]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api(`/vehicle-image?desc=${encodeURIComponent(desc!)}`)
      .then((d: any) => {
        if (cancelled) return;
        cache[key] = d.image || null;
        setUri(d.image || null);
      })
      .catch(() => {
        if (cancelled) return;
        cache[key] = null;
        setUri(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <View testID={testID} style={[styles.box, { width, height, borderRadius: rounded }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width, height, borderRadius: rounded }} resizeMode="cover" />
      ) : loading ? (
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      ) : (
        <Ionicons name="car-sport" size={Math.min(width, height) * 0.5} color={colors.brandPrimary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
