import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="boot-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  return <Redirect href={user.role === "driver" ? "/(driver)" : "/(customer)"} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
});
