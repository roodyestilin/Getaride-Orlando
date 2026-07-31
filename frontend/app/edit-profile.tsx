import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import DocumentField, { DocFile } from "@/src/components/DocumentField";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, font, radius, spacing } from "@/src/theme";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [photo, setPhoto] = useState<DocFile | null>(null);
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    router.replace("/auth");
    return null;
  }

  const previewUri = photo?.dataUrl || user.photo || undefined;
  const dirty = !!photo || phone.trim() !== (user.phone || "");

  const save = async () => {
    setError(null);
    if (phone.trim().length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (!dirty) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      const body: { phone?: string; photo?: string } = {};
      if (phone.trim() !== (user.phone || "")) body.phone = phone.trim();
      if (photo?.dataUrl) body.photo = photo.dataUrl;
      await api("/me", { method: "PATCH", body });
      await refreshUser();
      router.back();
    } catch (e: any) {
      setError(e?.message || "Could not save your changes. Please try again.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"] }}>
          <View style={styles.avatarWrap}>
            <Avatar uri={previewUri} size={96} />
            <Text style={styles.avatarHint}>Your profile photo is shown to drivers.</Text>
          </View>

          <DocumentField
            label="Profile photo"
            hint="a new profile photo (JPEG/PNG)"
            imageOnly
            testID="edit-photo-doc"
            value={photo}
            onChange={setPhoto}
          />

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              testID="edit-phone-input"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(407) 555-0123"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.input, styles.readonly]}>
              <Text style={styles.readonlyText}>{user.email}</Text>
              <Ionicons name="lock-closed" size={15} color={colors.muted} />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Save changes" onPress={save} loading={saving} disabled={!dirty && phone.trim() === (user.phone || "")} testID="save-profile" style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 24, alignItems: "flex-start" },
  headerTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  avatarWrap: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  avatarHint: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  field: { gap: spacing.xs, marginTop: spacing.lg },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  readonly: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary },
  readonlyText: { fontFamily: font.medium, fontSize: 15, color: colors.muted },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.error, marginTop: spacing.md },
});
