import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, font, radius, shadowSoft, spacing } from "@/src/theme";

function timeAgo(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function InboxList() {
  const insets = useSafeAreaInsets();
  const [convos, setConvos] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api("/inbox");
      setConvos(res.conversations);
    } catch {} finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startSupport = async () => {
    try {
      const res: any = await api("/support/start", { method: "POST" });
      router.push(`/chat/${res.ride_id}`);
    } catch {}
  };

  const remove = (ride_id: string) => {
    const doDelete = async () => {
      setConvos((c) => c.filter((x) => x.ride_id !== ride_id));
      try { await api(`/inbox/${ride_id}`, { method: "DELETE" }); } catch {}
    };
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm("Delete this conversation from your inbox?")) doDelete();
    } else {
      Alert.alert("Delete conversation", "Remove this conversation from your inbox?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Inbox</Text>
      <FlatList
        data={convos}
        keyExtractor={(c) => c.ride_id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, gap: spacing.md, paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <Pressable testID="contact-support" onPress={startSupport} style={styles.supportBtn}>
            <View style={styles.supportIcon}>
              <Ionicons name="headset" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Getaride Support</Text>
              <Text style={styles.supportSub}>Need help? Start a chat with our team.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={42} color={colors.surfaceTertiary} />
              <Text style={styles.emptyText}>No conversations yet.</Text>
              <Text style={styles.emptySub}>Messages with your {""}driver or rider will appear here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            testID={`convo-${item.ride_id}`}
            onPress={() => router.push(`/chat/${item.ride_id}`)}
          >
            <View style={[styles.avatar, item.is_support && styles.supportAvatar]}>
              <Ionicons name={item.is_support ? "headset" : "person"} size={20} color={item.is_support ? "#fff" : colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{item.other_name}</Text>
                <Text style={styles.time}>{timeAgo(item.last_at)}</Text>
              </View>
              <Text style={styles.last} numberOfLines={1}>{item.last_text}</Text>
              <Text style={styles.route} numberOfLines={1}>{item.route}</Text>
            </View>
            <Pressable
              testID={`delete-${item.ride_id}`}
              hitSlop={10}
              onPress={() => remove(item.ride_id)}
              style={styles.trash}
            >
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadowSoft },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  supportAvatar: { backgroundColor: colors.brandPrimary },
  supportBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs, ...shadowSoft },
  supportIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  supportTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  supportSub: { fontFamily: font.regular, fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  time: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginLeft: spacing.sm },
  last: { fontFamily: font.regular, fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 2 },
  route: { fontFamily: font.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  trash: { padding: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing["3xl"], paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: font.semibold, fontSize: 16, color: colors.onSurface },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
});
