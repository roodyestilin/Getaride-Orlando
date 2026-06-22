import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import Logo from "@/src/components/Logo";
import Button from "@/src/components/Button";
import { useAuth } from "@/src/auth";
import { colors, font, radius, spacing } from "@/src/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"customer" | "driver">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          vehicle: role === "driver" ? vehicle.trim() : undefined,
          plate: role === "driver" ? plate.trim() : undefined,
        });
      }
    } catch (e: any) {
      setError(e.message || "Authentication failed.");
      setLoading(false);
    }
  };

  const RoleTab = ({ value, label, icon }: { value: "customer" | "driver"; label: string; icon: any }) => {
    const active = role === value;
    return (
      <Pressable
        testID={`role-${value}`}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setRole(value);
        }}
        style={[styles.roleTab, active && styles.roleTabActive]}
      >
        <Ionicons name={icon} size={18} color={active ? "#fff" : colors.muted} />
        <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size={64} />
          <Text style={styles.title}>Getaride Orlando</Text>
          <Text style={styles.subtitle}>
            {mode === "login" ? "Welcome back. Sign in to continue." : "Create your account to get moving."}
          </Text>
        </View>

        {mode === "signup" && (
          <View style={styles.roleRow}>
            <RoleTab value="customer" label="Ride" icon="person-outline" />
            <RoleTab value="driver" label="Drive" icon="car-outline" />
          </View>
        )}

        <View style={styles.form}>
          {mode === "signup" && (
            <Field label="Full name" testID="name-input" value={name} onChangeText={setName} placeholder="Jane Doe" />
          )}
          <Field
            label="Email"
            testID="email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            testID="password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          {mode === "signup" && role === "driver" && (
            <>
              <Field label="Vehicle (e.g. Toyota Camry)" testID="vehicle-input" value={vehicle} onChangeText={setVehicle} placeholder="Toyota Camry" />
              <Field label="License plate" testID="plate-input" value={plate} onChangeText={setPlate} placeholder="FL 123AB" autoCapitalize="characters" />
            </>
          )}

          {error && (
            <Text style={styles.error} testID="auth-error">
              {error}
            </Text>
          )}

          <Button
            title={mode === "login" ? "Sign In" : "Create Account"}
            onPress={submit}
            loading={loading}
            testID="auth-submit"
            style={{ marginTop: spacing.sm }}
          />
        </View>

        <Pressable
          testID="toggle-mode"
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {mode === "login" ? "New to Getaride? " : "Already have an account? "}
            <Text style={styles.toggleLink}>{mode === "login" ? "Sign up" : "Sign in"}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  header: { alignItems: "center", gap: spacing.md, marginBottom: spacing["2xl"] },
  title: { fontFamily: font.bold, fontSize: 26, color: colors.onSurface },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  roleRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.xl,
  },
  roleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radius.sm + 2,
  },
  roleTabActive: { backgroundColor: colors.brandPrimary },
  roleText: { fontFamily: font.semibold, fontSize: 15, color: colors.muted },
  roleTextActive: { color: "#fff" },
  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.error },
  toggle: { marginTop: spacing.xl, alignItems: "center" },
  toggleText: { fontFamily: font.regular, fontSize: 14, color: colors.muted },
  toggleLink: { fontFamily: font.bold, color: colors.brandPrimary },
});
