import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, font, radius, spacing } from "@/src/theme";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const res: any = await api(`/rides/${id}/messages`);
      setMessages(res.messages);
    } catch {}
  }, [id]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 2000);
    return () => clearInterval(iv);
  }, [load]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, sender_role: user?.role, text: t, at: Date.now() / 1000 }]);
    try {
      await api(`/rides/${id}/messages`, { method: "POST", body: { text: t } });
      load();
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{user?.role === "driver" ? "Rider" : "Driver"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 8}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.empty}>Say hello 👋</Text>}
          renderItem={({ item }) => {
            const mine = item.sender_role === user?.role;
            return (
              <View style={[styles.bubbleRow, mine ? styles.rowEnd : styles.rowStart]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable testID="chat-send" onPress={send} style={styles.sendBtn}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  empty: { textAlign: "center", color: colors.muted, fontFamily: font.regular, marginTop: spacing.xl },
  bubbleRow: { flexDirection: "row" },
  rowEnd: { justifyContent: "flex-end" },
  rowStart: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: radius.sm },
  bubbleText: { fontFamily: font.regular, fontSize: 15, color: colors.onSurface },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, height: 48, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, fontFamily: font.regular, fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
