import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, font, radius, spacing } from "@/src/theme";
import type { LatLng } from "@/src/components/MapView";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (place: LatLng) => void;
};

export default function PlacePicker({ visible, title, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const q = query.trim();
    if (q.length >= 2) {
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
      // Search Box API: far better POI/lodging coverage (hotels, motels, resorts,
      // extended-stays). Restricted to the ~100-mile Orlando operating-area bbox.
      const url =
        `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(q)}` +
        `&access_token=${token}&proximity=-81.3789,28.5384` +
        `&bbox=-83.03,27.09,-79.73,29.99&country=us&limit=10&language=en`;
      fetch(url)
        .then((r) => r.json())
        .then((j: any) => {
          if (!active) return;
          const feats = (j?.features || [])
            .map((f: any) => {
              const p = f.properties || {};
              const coords = f.geometry?.coordinates || p.coordinates && [p.coordinates.longitude, p.coordinates.latitude] || [];
              const name = p.name || p.name_preferred || "";
              const addr = p.place_formatted || p.full_address || p.address || "";
              const label = addr && addr !== name ? `${name}${name ? ", " : ""}${addr}` : name;
              const cats = (Array.isArray(p.poi_category) ? p.poi_category.join(",") : "").toLowerCase();
              const isAirport = cats.includes("airport") || /airport/i.test(name);
              return { label: label || name, lat: coords[1], lng: coords[0], airport: isAirport };
            })
            .filter((x: any) => typeof x.lat === "number" && typeof x.lng === "number");
          setPlaces(feats);
        })
        .catch(() => {});
    } else {
      api(`/places?q=`)
        .then((r: any) => active && setPlaces(r.places))
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [query, visible]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} testID="place-picker">
      <View style={[styles.sheet, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <Pressable testID="place-picker-close" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="place-search-input"
            style={styles.search}
            placeholder="Search Orlando..."
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>

        <FlatList
          data={places}
          keyExtractor={(item, index) => `${item.label}-${index}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              testID={`place-option-${item.label}`}
              style={styles.row}
              onPress={() => {
                onSelect({ lat: item.lat, lng: item.lng, label: item.label, airport: !!item.airport });
                setQuery("");
                onClose();
              }}
            >
              <View style={styles.pin}>
                <Ionicons name="location" size={18} color={colors.brandPrimary} />
              </View>
              <Text style={styles.rowText}>{item.label}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No places found.</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50 },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  title: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
    marginBottom: spacing.md,
  },
  search: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  pin: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  empty: { fontFamily: font.regular, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
