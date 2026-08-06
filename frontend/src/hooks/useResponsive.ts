import { useWindowDimensions } from "react-native";

// Desktop marketing experience kicks in at >= 1024px. Phones/tablets keep the
// existing mobile app untouched.
export const DESKTOP_BREAKPOINT = 1024;

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
