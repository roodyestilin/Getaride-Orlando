import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

const STATUS_LABEL: Record<string, string> = {
  searching: "Searching",
  driver_enroute: "Driver on the way",
  arrived: "Driver arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CustomerTrips() {
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api("/me/rides");
      setRides(res.rides);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Your Activity</Text>
      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.brandPrimary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={48} color={colors.surfaceTertiary} />
            <Text style={styles.emptyText}>No trips yet. Book your first ride!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const done = item.status === "completed";
          return (
            <View style={styles.card} testID={`trip-${item.id}`}>
              <View style={styles.cardTop}>
                <View style={[styles.statusDot, { backgroundColor: done ? colors.success : item.status === "cancelled" ? colors.error : colors.brandPrimary }]} />
                <Text style={styles.statusText}>{STATUS_LABEL[item.status] || item.status}</Text>
                <Text style={styles.fare}>${(item.final_fare ?? item.recommended_fare).toFixed(2)}</Text>
              </View>
              <Route pickup={item.pickup.label} destination={item.destination.label} />
              <Text style={styles.meta}>
                {item.distance_miles} mi · {item.when === "scheduled" ? "Scheduled" : "Now"}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

function Route({ pickup, destination }: { pickup: string; destination: string }) {
  return (
    <View style={styles.route}>
      <View style={styles.routeCol}>
        <Ionicons name="ellipse" size={10} color={colors.success} />
        <View style={styles.routeLine} />
        <Ionicons name="location" size={12} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1, gap: spacing.md }}>
        <Text style={styles.routeText} numberOfLines={1}>{pickup}</Text>
        <Text style={styles.routeText} numberOfLines={1}>{destination}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadowSoft, gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.onSurfaceSecondary },
  fare: { fontFamily: font.monoBold, fontSize: 16, color: colors.onSurface },
  route: { flexDirection: "row", gap: spacing.md },
  routeCol: { alignItems: "center", paddingTop: 2 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  routeText: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  meta: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  empty: { alignItems: "center", marginTop: 100, gap: spacing.md },
  emptyText: { fontFamily: font.medium, color: colors.muted },
});
