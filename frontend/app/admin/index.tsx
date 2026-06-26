import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, setToken } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { colors, font, radius, shadow, shadowSoft, spacing } from "@/src/theme";

type Section = "overview" | "live" | "conversations" | "users" | "rides";

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("admin@getaride.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [live, setLive] = useState<any[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [openConvo, setOpenConvo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet<string | null>("admin_token", null);
      if (t) {
        setToken(t);
        try {
          const me: any = await api("/auth/me");
          if (me.user?.role === "admin") setAuthed(true);
        } catch {}
      }
      setBooting(false);
    })();
  }, []);

  const loadUsers = () => api("/admin/users").then((r: any) => setUsers(r.users)).catch(() => {});
  const loadConvos = () => api("/admin/conversations").then((r: any) => setConvos(r.conversations)).catch(() => {});
  const loadLive = () => api("/admin/live").then((r: any) => setLive(r.live)).catch(() => {});

  useEffect(() => {
    if (!authed) return;
    api("/admin/overview").then(setOverview).catch(() => {});
    loadConvos(); loadUsers(); loadLive();
    api("/admin/rides").then((r: any) => setRides(r.rides)).catch(() => {});
  }, [authed]);

  useEffect(() => {
    if (!authed || section !== "live") return;
    const iv = setInterval(loadLive, 4000);
    return () => clearInterval(iv);
  }, [authed, section]);

  const login = async () => {
    setError(""); setBusy(true);
    try {
      const res: any = await api("/auth/login", { method: "POST", body: { email: email.trim(), password } });
      if (res.user?.role !== "admin") { setError("This account is not an admin."); return; }
      setToken(res.token);
      await storage.secureSet("admin_token", res.token);
      setAuthed(true);
    } catch (e: any) { setError(e?.message || "Login failed."); }
    finally { setBusy(false); }
  };

  const logout = async () => { await storage.secureRemove("admin_token"); setToken(null); setAuthed(false); setPassword(""); };

  const setDriverStatus = async (id: string, status: string) => {
    try { await api(`/admin/drivers/${id}/status`, { method: "POST", body: { status } }); await loadUsers(); } catch {}
  };

  const openDoc = (dataUrl: string) => {
    if (!dataUrl) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const w = window.open();
      if (w) {
        if (dataUrl.includes("application/pdf")) {
          w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100%"></iframe>`);
        } else {
          w.document.write(`<img src="${dataUrl}" style="max-width:100%" />`);
        }
      }
    } else {
      Linking.openURL(dataUrl).catch(() => {});
    }
  };

  const sendSupport = async (ride_id: string) => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      await api(`/admin/conversations/${ride_id}/message`, { method: "POST", body: { text } });
      await loadConvos();
    } catch {}
  };

  if (booting) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;

  if (!authed) {
    return (
      <View style={styles.center}>
        <View style={styles.loginCard}>
          <View style={styles.brandRow}><Ionicons name="shield-checkmark" size={26} color={colors.brandPrimary} /><Text style={styles.brandText}>Getaride Admin</Text></View>
          <Text style={styles.loginSub}>Sign in to manage the platform.</Text>
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={colors.muted} testID="admin-email" />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor={colors.muted} testID="admin-password" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.loginBtn} onPress={login} disabled={busy} testID="admin-login">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  const tabs: Section[] = ["overview", "live", "conversations", "users", "rides"];

  return (
    <View style={styles.dash}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}><Ionicons name="shield-checkmark" size={22} color="#fff" /><Text style={styles.topTitle}>Getaride Admin</Text></View>
        <Pressable onPress={logout} style={styles.logout} testID="admin-logout"><Ionicons name="log-out-outline" size={16} color="#fff" /><Text style={styles.logoutText}>Sign out</Text></Pressable>
      </View>

      <View style={styles.tabbar}>
        {tabs.map((s) => (
          <Pressable key={s} onPress={() => setSection(s)} style={[styles.tab, section === s && styles.tabActive]} testID={`admin-tab-${s}`}>
            <Text style={[styles.tabText, section === s && styles.tabTextActive]}>{s[0].toUpperCase() + s.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, maxWidth: 1000, width: "100%", alignSelf: "center" }}>
        {section === "overview" ? (
          <View style={styles.statGrid}>
            <Metric label="Revenue" value={`$${(overview?.revenue ?? 0).toFixed(2)}`} icon="cash" />
            <Metric label="Tips" value={`$${(overview?.tips ?? 0).toFixed(2)}`} icon="heart" />
            <Metric label="Completed trips" value={overview?.completed_trips ?? 0} icon="checkmark-done" />
            <Metric label="Active rides" value={overview?.active_rides ?? 0} icon="car-sport" />
            <Metric label="Total rides" value={overview?.total_rides ?? 0} icon="map" />
            <Metric label="Drivers" value={overview?.drivers ?? 0} icon="person" />
            <Metric label="Drivers online" value={overview?.drivers_online ?? 0} icon="radio" />
            <Metric label="Customers" value={overview?.customers ?? 0} icon="people" />
          </View>
        ) : null}

        {section === "live" ? (
          <>
            <Text style={styles.liveHead}>● Live trips in progress ({live.length})</Text>
            {live.length === 0 ? <Text style={styles.empty}>No trips in progress right now.</Text> :
              live.map((r) => (
                <View key={r.id} style={styles.card} testID={`live-${r.id}`}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{r.customer_name} · {r.driver_name || "—"}</Text>
                    <View style={styles.statusPill}><Text style={styles.statusPillText}>{r.status.replace("_", " ")}</Text></View>
                  </View>
                  <Text style={styles.cardSub} numberOfLines={1}>{r.pickup.label} → {r.destination.label}</Text>
                  <Text style={styles.fareInline}>${(r.fare ?? 0).toFixed(2)}</Text>
                </View>
              ))}
          </>
        ) : null}

        {section === "conversations" ? (
          convos.length === 0 ? <Text style={styles.empty}>No conversations yet.</Text> :
          convos.map((c) => (
            <View key={c.ride_id} style={styles.card}>
              <Pressable onPress={() => setOpenConvo(openConvo === c.ride_id ? null : c.ride_id)} testID={`admin-convo-${c.ride_id}`}>
                <Text style={styles.cardTitle}>{c.customer_name} ↔ {c.driver_name}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{c.route}</Text>
              </Pressable>
              {openConvo === c.ride_id ? (
                <View>
                  <View style={styles.thread}>
                    {c.messages.map((m: any) => (
                      <View key={m.id} style={[styles.msg, m.sender_role === "driver" ? styles.msgDriver : m.sender_role === "support" ? styles.msgSupport : styles.msgCustomer]}>
                        <Text style={styles.msgFrom}>{m.sender_name} · {m.sender_role}</Text>
                        <Text style={styles.msgText}>{m.text}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.composer}>
                    <TextInput style={styles.composerInput} placeholder="Reply as Getaride Support…" value={draft} onChangeText={setDraft} placeholderTextColor={colors.muted} testID={`support-input-${c.ride_id}`} />
                    <Pressable style={styles.sendBtn} onPress={() => sendSupport(c.ride_id)} testID={`support-send-${c.ride_id}`}><Ionicons name="send" size={16} color="#fff" /></Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ))
        ) : null}

        {section === "users" ? (
          users.map((u) => (
            <View key={u.id} style={styles.card} testID={`admin-user-${u.id}`}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{u.name} <Text style={styles.roleTag}>{u.role}</Text></Text>
                {u.role === "driver" ? <View style={[styles.statusPill, statusColor(u.approval_status)]}><Text style={styles.statusPillText}>{u.approval_status}</Text></View> : null}
              </View>
              <Text style={styles.cardSub}>{u.email}{u.vehicle ? ` · ${u.color || ""} ${u.vehicle} · ${u.plate || ""}` : ""}</Text>
              {u.role === "driver" && (u.license_number || u.insurance_provider) ? (
                <Text style={styles.cardSub}>License #{u.license_number || "—"} · {u.insurance_provider || "No insurer"}</Text>
              ) : null}
              {u.role === "driver" && (u.license_doc || u.insurance_doc || u.registration_doc) ? (
                <View style={styles.docRow}>
                  {u.license_doc ? <DocChip label="License" onPress={() => openDoc(u.license_doc)} tid={`doc-license-${u.id}`} /> : null}
                  {u.insurance_doc ? <DocChip label="Insurance" onPress={() => openDoc(u.insurance_doc)} tid={`doc-insurance-${u.id}`} /> : null}
                  {u.registration_doc ? <DocChip label="Registration" onPress={() => openDoc(u.registration_doc)} tid={`doc-registration-${u.id}`} /> : null}
                </View>
              ) : null}
              {u.role === "driver" ? (
                <View style={styles.btnRow}>
                  {u.approval_status !== "approved" ? <Act label="Approve" color={colors.success} onPress={() => setDriverStatus(u.id, "approved")} tid={`approve-${u.id}`} /> : null}
                  {u.approval_status === "pending" ? <Act label="Decline" color={colors.error} onPress={() => setDriverStatus(u.id, "declined")} tid={`decline-${u.id}`} /> : null}
                  {u.approval_status === "approved" ? <Act label="Deactivate" color={colors.error} onPress={() => setDriverStatus(u.id, "deactivated")} tid={`deactivate-${u.id}`} /> : null}
                  {u.approval_status === "deactivated" || u.approval_status === "declined" ? <Act label="Reactivate" color={colors.success} onPress={() => setDriverStatus(u.id, "approved")} tid={`reactivate-${u.id}`} /> : null}
                </View>
              ) : null}
            </View>
          ))
        ) : null}

        {section === "rides" ? (
          rides.length === 0 ? <Text style={styles.empty}>No rides yet.</Text> :
          rides.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>{r.pickup.label} → {r.destination.label}</Text>
                <Text style={styles.fareInline}>${((r.final_fare ?? r.recommended_fare ?? 0) + (r.tip ?? 0)).toFixed(2)}</Text>
              </View>
              <Text style={styles.cardSub}>{r.customer_name || "Rider"} · {r.status} · {(r.distance_miles ?? "?")} mi · tip ${(r.tip ?? 0).toFixed(2)}</Text>
            </View>
          ))
        ) : null}
      </ScrollView>
    </View>
  );
}

function statusColor(s: string) {
  if (s === "approved") return { backgroundColor: "#dcfce7" };
  if (s === "pending") return { backgroundColor: "#fef9c3" };
  return { backgroundColor: "#fee2e2" };
}
function Act({ label, color, onPress, tid }: any) {
  return <Pressable onPress={onPress} testID={tid} style={[styles.act, { borderColor: color }]}><Text style={[styles.actText, { color }]}>{label}</Text></Pressable>;
}
function DocChip({ label, onPress, tid }: any) {
  return (
    <Pressable onPress={onPress} testID={tid} style={styles.docChip}>
      <Ionicons name="document-attach-outline" size={14} color={colors.brandPrimary} />
      <Text style={styles.docChipText}>{label}</Text>
    </Pressable>
  );
}
function Metric({ label, value, icon }: any) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={20} color={colors.brandPrimary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loginCard: { width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, ...shadow },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  loginSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontFamily: font.medium, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.error },
  loginBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  loginBtnText: { fontFamily: font.semibold, fontSize: 15, color: "#fff" },
  dash: { flex: 1, backgroundColor: colors.bg },
  topbar: { backgroundColor: colors.brandPrimary, paddingTop: spacing.xl, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topTitle: { fontFamily: font.bold, fontSize: 18, color: "#fff" },
  logout: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md },
  logoutText: { fontFamily: font.semibold, fontSize: 13, color: "#fff" },
  tabbar: { flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.sm, flexWrap: "wrap" },
  tab: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.brandPrimary },
  tabText: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  tabTextActive: { color: colors.brandPrimary, fontFamily: font.semibold },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: { width: 220, flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: 4, ...shadowSoft },
  metricValue: { fontFamily: font.bold, fontSize: 24, color: colors.onSurface },
  metricLabel: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  liveHead: { fontFamily: font.bold, fontSize: 15, color: colors.success, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, ...shadowSoft },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  cardTitle: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  cardSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  fareInline: { fontFamily: font.monoBold, fontSize: 15, color: colors.brandPrimary },
  statusPill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSecondary },
  statusPillText: { fontFamily: font.semibold, fontSize: 11, color: colors.onSurface, textTransform: "capitalize" },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  docRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  docChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: spacing.md },
  docChipText: { fontFamily: font.semibold, fontSize: 12, color: colors.brandPrimary },
  act: { borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: spacing.md },
  actText: { fontFamily: font.semibold, fontSize: 13 },
  roleTag: { fontFamily: font.medium, fontSize: 12, color: colors.muted },
  thread: { marginTop: spacing.md, gap: spacing.sm },
  msg: { maxWidth: "85%", borderRadius: radius.md, padding: spacing.md },
  msgDriver: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary },
  msgCustomer: { alignSelf: "flex-end", backgroundColor: colors.brandTertiary },
  msgSupport: { alignSelf: "center", backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fdba74" },
  msgFrom: { fontFamily: font.medium, fontSize: 11, color: colors.muted, marginBottom: 2 },
  msgText: { fontFamily: font.regular, fontSize: 14, color: colors.onSurface },
  composer: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  composerInput: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  sendBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
