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

const STEP_TITLES = ["Your account", "Vehicle details", "License & insurance"];

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"customer" | "driver">("customer");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [plate, setPlate] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDriverSignup = mode === "signup" && role === "driver";

  const doRegister = async () => {
    setLoading(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        phone: phone.trim() || undefined,
        vehicle_make: role === "driver" ? vehicleMake.trim() : undefined,
        vehicle_model: role === "driver" ? vehicleModel.trim() : undefined,
        vehicle_year: role === "driver" ? vehicleYear.trim() : undefined,
        vehicle_color: role === "driver" ? vehicleColor.trim() : undefined,
        plate: role === "driver" ? plate.trim() : undefined,
        license_number: role === "driver" ? licenseNumber.trim() : undefined,
        insurance_provider: role === "driver" ? insuranceProvider.trim() : undefined,
      });
    } catch (e: any) {
      setError(e.message || "Authentication failed.");
      setLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (mode === "login") {
      if (!email || !password) { setError("Please fill in all required fields."); return; }
      setLoading(true);
      try { await signIn(email.trim(), password); }
      catch (e: any) { setError(e.message || "Authentication failed."); setLoading(false); }
      return;
    }
    if (!isDriverSignup) {
      if (!name || !email || !password) { setError("Please fill in all required fields."); return; }
      doRegister();
      return;
    }
    // Driver multi-step onboarding
    if (step === 0) {
      if (!name || !email || !password) { setError("Please fill in your account details."); return; }
      Haptics.selectionAsync().catch(() => {});
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!vehicleMake || !vehicleModel || !vehicleYear || !plate) { setError("Please complete your vehicle details."); return; }
      Haptics.selectionAsync().catch(() => {});
      setStep(2);
      return;
    }
    if (!licenseNumber) { setError("Please enter your driver's license number."); return; }
    doRegister();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setStep(0);
    setError(null);
  };

  const switchRole = (value: "customer" | "driver") => {
    Haptics.selectionAsync().catch(() => {});
    setRole(value);
    setStep(0);
    setError(null);
  };

  const RoleTab = ({ value, label, icon }: { value: "customer" | "driver"; label: string; icon: any }) => {
    const active = role === value;
    return (
      <Pressable testID={`role-${value}`} onPress={() => switchRole(value)} style={[styles.roleTab, active && styles.roleTabActive]}>
        <Ionicons name={icon} size={18} color={active ? "#fff" : colors.muted} />
        <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  let submitLabel = "Sign In";
  if (mode === "signup") {
    if (isDriverSignup) submitLabel = step < 2 ? "Continue" : "Submit Application";
    else submitLabel = "Create Account";
  }

  const subtitle = mode === "login"
    ? "Welcome back. Sign in to continue."
    : isDriverSignup
      ? "Become a Getaride driver in 3 quick steps."
      : "Create your account to get moving.";

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
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {mode === "signup" && (
          <View style={styles.roleRow}>
            <RoleTab value="customer" label="Ride" icon="person-outline" />
            <RoleTab value="driver" label="Drive" icon="car-outline" />
          </View>
        )}

        {isDriverSignup && (
          <View style={styles.stepperRow} testID="signup-stepper">
            {STEP_TITLES.map((t, i) => (
              <View key={t} style={styles.stepItem}>
                <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                  {i < step ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
                  )}
                </View>
                {i < STEP_TITLES.length - 1 && <View style={[styles.stepBar, i < step && styles.stepBarDone]} />}
              </View>
            ))}
          </View>
        )}
        {isDriverSignup && <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>}

        <View style={styles.form}>
          {/* Account step (also used by customer signup) */}
          {(mode === "login" || !isDriverSignup || step === 0) && (
            <>
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
              {isDriverSignup && (
                <Field label="Phone number" testID="phone-input" value={phone} onChangeText={setPhone} placeholder="(407) 555-0123" keyboardType="phone-pad" />
              )}
            </>
          )}

          {/* Vehicle step */}
          {isDriverSignup && step === 1 && (
            <>
              <Field label="Make" testID="make-input" value={vehicleMake} onChangeText={setVehicleMake} placeholder="Toyota" />
              <Field label="Model" testID="model-input" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Camry" />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field label="Year" testID="year-input" value={vehicleYear} onChangeText={setVehicleYear} placeholder="2021" keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Color" testID="color-input" value={vehicleColor} onChangeText={setVehicleColor} placeholder="Silver" />
                </View>
              </View>
              <Field label="License plate" testID="plate-input" value={plate} onChangeText={setPlate} placeholder="FL 123AB" autoCapitalize="characters" />
            </>
          )}

          {/* License step */}
          {isDriverSignup && step === 2 && (
            <>
              <Field label="Driver's license number" testID="license-input" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="D123-456-78-901-0" autoCapitalize="characters" />
              <Field label="Insurance provider" testID="insurance-input" value={insuranceProvider} onChangeText={setInsuranceProvider} placeholder="GEICO, State Farm…" />
              <View style={styles.reviewNote}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandPrimary} />
                <Text style={styles.reviewNoteText}>Your application will be reviewed by Getaride. You can browse the app, but can&apos;t accept rides until you&apos;re approved.</Text>
              </View>
            </>
          )}

          {error && (
            <Text style={styles.error} testID="auth-error">{error}</Text>
          )}

          <View style={styles.actionRow}>
            {isDriverSignup && step > 0 && (
              <Pressable testID="step-back" onPress={() => { setStep(step - 1); setError(null); }} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.brandPrimary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            <Button
              title={submitLabel}
              onPress={submit}
              loading={loading}
              testID="auth-submit"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <Pressable testID="toggle-mode" onPress={switchMode} style={styles.toggle}>
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
  row: { flexDirection: "row", gap: spacing.md },
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
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border },
  stepDotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepNum: { fontFamily: font.bold, fontSize: 13, color: colors.muted },
  stepNumActive: { color: "#fff" },
  stepBar: { width: 36, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  stepBarDone: { backgroundColor: colors.success },
  stepTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface, textAlign: "center", marginBottom: spacing.lg },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, height: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  backText: { fontFamily: font.semibold, fontSize: 15, color: colors.brandPrimary },
  reviewNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  reviewNoteText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.brandPrimary, lineHeight: 18 },
  toggle: { marginTop: spacing.xl, alignItems: "center" },
  toggleText: { fontFamily: font.regular, fontSize: 14, color: colors.muted },
  toggleLink: { fontFamily: font.bold, color: colors.brandPrimary },
});
