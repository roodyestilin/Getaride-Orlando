import { Redirect } from "expo-router";
import { useIsDesktop } from "@/src/hooks/useResponsive";
import DesktopChrome from "@/src/components/desktop/DesktopChrome";
import DesktopRiders from "@/src/components/desktop/DesktopRiders";

export default function RidersPage() {
  const isDesktop = useIsDesktop();
  // On mobile there's no marketing page — send riders straight into the app.
  if (!isDesktop) return <Redirect href="/(customer)" />;
  return (
    <DesktopChrome active="riders">
      <DesktopRiders />
    </DesktopChrome>
  );
}
