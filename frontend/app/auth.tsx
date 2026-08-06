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
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";

import Logo from "@/src/components/Logo";
import Button from "@/src/components/Button";
import SelectField from "@/src/components/SelectField";
import DocumentField, { DocFile } from "@/src/components/DocumentField";
import { MAKE_LIST, VEHICLE_MAKES, VEHICLE_YEARS, classifyVehicle, VEHICLE_CLASS_INFO } from "@/src/data/vehicles";
import { DRIVER_AGREEMENT_SECTIONS, DRIVER_AGREEMENT_VERSION } from "@/src/data/driverAgreement";
import { useAuth } from "@/src/auth";
import { colors, font, radius, spacing } from "@/src/theme";

const DRIVER_STEP_TITLES = ["Your account", "Vehicle details", "License & documents", "Driver Agreement"];
const CUSTOMER_STEP_TITLES = ["Your details", "Profile photo"];

// MM/DD/YYYY → whole years old.
function ageFromDob(mmddyyyy: string): number | null {
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const mm = +m[1], dd = +m[2], yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const now = new Date();
  let age = now.getFullYear() - yyyy;
  if (now.getMonth() + 1 < mm || (now.getMonth() + 1 === mm && now.getDate() < dd)) age--;
  return age;
}

function dobToISO(mmddyyyy: string): string | undefined {
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function formatDob(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"customer" | "driver">("customer");
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [plate, setPlate] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [ssn, setSsn] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [photo, setPhoto] = useState<DocFile | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<DocFile | null>(null);
  const [insuranceDoc, setInsuranceDoc] = useState<DocFile | null>(null);
  const [registrationDoc, setRegistrationDoc] = useState<DocFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDriverSignup = mode === "signup" && role === "driver";
  const isCustomerSignup = mode === "signup" && role === "customer";
  const stepTitles = isDriverSignup ? DRIVER_STEP_TITLES : CUSTOMER_STEP_TITLES;
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const modelOptions = vehicleMake ? (VEHICLE_MAKES[vehicleMake] ?? []) : [];

  // Deep link (a separate link shared with prospective drivers): /auth?role=driver
  React.useEffect(() => {
    if (params.role === "driver") {
      setRole("driver");
      setMode("signup");
      setStep(0);
    }
  }, [params.role]);

  const doRegister = async () => {
    setLoading(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        name: fullName,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        role,
        phone: phone.trim() || undefined,
        date_of_birth: role === "customer" ? dobToISO(dob) : undefined,
        photo: photo?.dataUrl,
        vehicle_make: role === "driver" ? vehicleMake.trim() : undefined,
        vehicle_model: role === "driver" ? vehicleModel.trim() : undefined,
        vehicle_year: role === "driver" ? vehicleYear.trim() : undefined,
        vehicle_color: role === "driver" ? vehicleColor.trim() : undefined,
        plate: role === "driver" ? plate.trim() : undefined,
        license_number: role === "driver" ? licenseNumber.trim() : undefined,
        ssn: role === "driver" ? ssn.replace(/\D/g, "") : undefined,
        agreed_terms: role === "driver" ? agreedTerms : undefined,
        license_doc: role === "driver" ? licenseDoc?.dataUrl : undefined,
        insurance_doc: role === "driver" ? insuranceDoc?.dataUrl : undefined,
        registration_doc: role === "driver" ? registrationDoc?.dataUrl : undefined,
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
      // Customer signup: step 0 = details, step 1 = profile photo.
      if (step === 0) {
        if (!firstName || !lastName || !email || !password) { setError("Please fill in all required fields."); return; }
        if (phone.trim().length < 7) { setError("Please enter a valid phone number."); return; }
        const age = ageFromDob(dob);
        if (age === null) { setError("Please enter your date of birth as MM/DD/YYYY."); return; }
        if (age < 18) { setError("You must be at least 18 years old to use Getaride."); return; }
        Haptics.selectionAsync().catch(() => {});
        setStep(1);
        return;
      }
      if (!photo) { setError("Please add a profile photo."); return; }
      doRegister();
      return;
    }
    // Driver multi-step onboarding
    if (step === 0) {
      if (!firstName || !lastName || !email || !password) { setError("Please fill in your account details."); return; }
      if (!photo) { setError("Please add a profile photo."); return; }
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
    if (step === 2) {
      if (!licenseNumber) { setError("Please enter your driver's license number."); return; }
      if (ssn.replace(/\D/g, "").length !== 9) { setError("Please enter a valid 9-digit Social Security Number."); return; }
      if (!licenseDoc || !insuranceDoc || !registrationDoc) { setError("Please upload your license, insurance and registration documents."); return; }
      Haptics.selectionAsync().catch(() => {});
      setStep(3);
      return;
    }
    if (!agreedTerms) { setError("You must accept the Driver Agreement to submit your application."); return; }
    doRegister();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setRole("customer");
    setStep(0);
    setDob("");
    setError(null);
  };

  let submitLabel = "Sign In";
  if (mode === "signup") {
    if (isDriverSignup) submitLabel = step < 3 ? "Continue" : "Submit Application";
    else submitLabel = step < 1 ? "Continue" : "Create Account";
  }

  const subtitle = mode === "login"
    ? "Welcome back. Sign in to continue."
    : isDriverSignup
      ? "Become a Getaride driver in 4 quick steps."
      : "Create your rider account to get moving.";

  const formatSsn = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
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
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {(isDriverSignup || isCustomerSignup) && (
          <View style={styles.stepperRow} testID="signup-stepper">
            {stepTitles.map((t, i) => (
              <View key={t} style={styles.stepItem}>
                <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                  {i < step ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
                  )}
                </View>
                {i < stepTitles.length - 1 && <View style={[styles.stepBar, i < step && styles.stepBarDone]} />}
              </View>
            ))}
          </View>
        )}
        {(isDriverSignup || isCustomerSignup) && <Text style={styles.stepTitle}>{stepTitles[step]}</Text>}

        <View style={styles.form}>
          {/* Account / details step (login, driver step 0, customer step 0) */}
          {(mode === "login" || step === 0) && (
            <>
              {mode === "signup" && (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field label="First name" testID="first-name-input" value={firstName} onChangeText={setFirstName} placeholder="Jane" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Last name" testID="last-name-input" value={lastName} onChangeText={setLastName} placeholder="Doe" />
                  </View>
                </View>
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
              {mode === "signup" && (
                <Field label="Phone number" testID="phone-input" value={phone} onChangeText={setPhone} placeholder="(407) 555-0123" keyboardType="phone-pad" />
              )}
              {isCustomerSignup && (
                <>
                  <Field label="Date of birth" testID="dob-input" value={dob} onChangeText={(t: string) => setDob(formatDob(t))} placeholder="MM/DD/YYYY" keyboardType="number-pad" />
                  <Text style={styles.hintText}>You must be 18 or older to use Getaride.</Text>
                </>
              )}
              {isDriverSignup && (
                <DocumentField label="Profile photo" hint="a profile photo (JPEG/PNG)" imageOnly testID="photo-doc" value={photo} onChange={setPhoto} />
              )}
            </>
          )}

          {/* Customer profile-photo step */}
          {isCustomerSignup && step === 1 && (
            <>
              <Text style={styles.photoIntro}>Add a clear photo of yourself so your driver can find you.</Text>
              <DocumentField label="Profile photo" hint="a profile photo (JPEG/PNG)" imageOnly testID="photo-doc" value={photo} onChange={setPhoto} />
            </>
          )}

          {/* Vehicle step */}
          {isDriverSignup && step === 1 && (
            <>
              <SelectField
                label="Make"
                testID="make-select"
                value={vehicleMake}
                options={MAKE_LIST}
                placeholder="Select make"
                onSelect={(m) => { setVehicleMake(m); setVehicleModel(""); }}
              />
              <SelectField
                label="Model"
                testID="model-select"
                value={vehicleModel}
                options={modelOptions}
                placeholder={vehicleMake ? "Select model" : "Select a make first"}
                disabled={!vehicleMake || modelOptions.length === 0}
                onSelect={setVehicleModel}
              />
              {vehicleMake && modelOptions.length === 0 && (
                <Field label="Model" testID="model-input" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Enter model" />
              )}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <SelectField label="Year" testID="year-select" value={vehicleYear} options={VEHICLE_YEARS} placeholder="Year" searchable={false} onSelect={setVehicleYear} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Color" testID="color-input" value={vehicleColor} onChangeText={setVehicleColor} placeholder="Silver" />
                </View>
              </View>
              <Field label="License plate" testID="plate-input" value={plate} onChangeText={setPlate} placeholder="FL 123AB" autoCapitalize="characters" />
              {vehicleModel ? (
                <View style={styles.classBadge} testID="detected-class">
                  <Ionicons name="car-sport" size={18} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.classBadgeLabel}>Vehicle category</Text>
                    <Text style={styles.classBadgeValue}>
                      {VEHICLE_CLASS_INFO[classifyVehicle(vehicleMake, vehicleModel)].label}
                      {" · up to "}
                      {VEHICLE_CLASS_INFO[classifyVehicle(vehicleMake, vehicleModel)].maxPax} riders,
                      {" "}{VEHICLE_CLASS_INFO[classifyVehicle(vehicleMake, vehicleModel)].maxBags} bags
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text style={styles.hintText}>Vehicles must be model year 2010 or newer. Your category is set automatically from your make & model.</Text>
            </>
          )}

          {/* License & documents step */}
          {isDriverSignup && step === 2 && (
            <>
              <Field label="Driver's license number" testID="license-input" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="D123-456-78-901-0" autoCapitalize="characters" />
              <Field label="Social Security Number" testID="ssn-input" value={ssn} onChangeText={(t) => setSsn(formatSsn(t))} placeholder="123-45-6789" keyboardType="number-pad" />
              <Text style={styles.hintText}>Your SSN is verified securely and used only for your background check.</Text>
              <DocumentField label="Driver's license photo" hint="license (JPEG or PDF)" testID="license-doc" value={licenseDoc} onChange={setLicenseDoc} />
              <DocumentField label="Insurance document" hint="insurance (JPEG or PDF)" testID="insurance-doc" value={insuranceDoc} onChange={setInsuranceDoc} />
              <DocumentField label="Vehicle registration" hint="registration (JPEG or PDF)" testID="registration-doc" value={registrationDoc} onChange={setRegistrationDoc} />
            </>
          )}

          {/* Driver Agreement step */}
          {isDriverSignup && step === 3 && (
            <>
              <View style={styles.agreementBox}>
                <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  <Text style={styles.agreementHeading}>Getaride Driver Agreement</Text>
                  <Text style={styles.agreementVersion}>Version {DRIVER_AGREEMENT_VERSION} · Orlando, FL</Text>
                  {DRIVER_AGREEMENT_SECTIONS.map((s) => (
                    <View key={s.title} style={{ marginTop: spacing.md }}>
                      <Text style={styles.agreementTitle}>{s.title}</Text>
                      <Text style={styles.agreementBody}>{s.body}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <Pressable testID="agree-checkbox" onPress={() => setAgreedTerms((v) => !v)} style={styles.agreeRow}>
                <View style={[styles.checkbox, agreedTerms && styles.checkboxOn]}>
                  {agreedTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.agreeText}>I have read and agree to the Getaride Driver Agreement and authorize the background and identity checks described above.</Text>
              </Pressable>
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

        {role === "driver" ? (
          <Pressable testID="back-to-rider" onPress={() => { setRole("customer"); setStep(0); setError(null); }} style={styles.driverLink}>
            <Ionicons name="arrow-back" size={14} color={colors.muted} />
            <Text style={styles.driverLinkText}>Back to rider sign up</Text>
          </Pressable>
        ) : (
          <Pressable testID="become-driver" onPress={() => router.push("/drive-with-us")} style={styles.driverLink}>
            <Ionicons name="car-outline" size={15} color={colors.brandPrimary} />
            <Text style={styles.driverLinkText}>Want to drive with Getaride? <Text style={styles.toggleLink}>Apply here</Text></Text>
          </Pressable>
        )}
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
  hintText: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: -spacing.xs },
  classBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  classBadgeLabel: { fontFamily: font.medium, fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  classBadgeValue: { fontFamily: font.bold, fontSize: 14.5, color: colors.onSurface, marginTop: 1 },
  agreementBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary },
  agreementHeading: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface },
  agreementVersion: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  agreementTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface, marginBottom: 2 },
  agreementBody: { fontFamily: font.regular, fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 19 },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.xs },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  agreeText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  toggle: { marginTop: spacing.xl, alignItems: "center" },
  toggleText: { fontFamily: font.regular, fontSize: 14, color: colors.muted },
  toggleLink: { fontFamily: font.bold, color: colors.brandPrimary },
  photoIntro: { fontFamily: font.regular, fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: spacing.xs },
  driverLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.lg },
  driverLinkText: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
});
