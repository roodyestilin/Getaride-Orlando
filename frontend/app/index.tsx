import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";
import { useIsDesktop } from "@/src/hooks/useResponsive";
import DesktopChrome from "@/src/components/desktop/DesktopChrome";
import DesktopLanding from "@/src/components/desktop/DesktopLanding";

export default function Index() {
  const { user, loading } = useAuth();
  const isDesktop = useIsDesktop();

  if (loading) {
    return (
      <View style={styles.center} testID="boot-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  // Desktop guests get the Lyft-style marketing landing page.
  if (isDesktop && !user) {
    return (
      <DesktopChrome active="home">
        <DesktopLanding />
      </DesktopChrome>
    );
  }

  // Mobile (and signed-in users) go straight into the app — unchanged.
  if (!user) return <Redirect href="/(customer)" />;
  return <Redirect href={user.role === "driver" ? "/(driver)" : "/(customer)"} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
});
