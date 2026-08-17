export const lightColors = {
  surface: "#ffffff",
  onSurface: "#18181b",
  surfaceSecondary: "#f4f4f5",
  onSurfaceSecondary: "#27272a",
  surfaceTertiary: "#e4e4e7",
  onSurfaceTertiary: "#3f3f46",
  surfaceInverse: "#18181b",
  onSurfaceInverse: "#ffffff",
  brand: "#a855f7",
  brandPrimary: "#9333ea",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#c084fc",
  brandTertiary: "#f3e8ff",
  onBrandTertiary: "#7e22ce",
  success: "#22c55e",
  onSuccess: "#ffffff",
  warning: "#f59e0b",
  error: "#ef4444",
  muted: "#71717a",
  border: "#e4e4e7",
  borderStrong: "#a1a1aa",
  divider: "#f4f4f5",
};

export const darkColors: typeof lightColors = {
  surface: "#101014",
  onSurface: "#f4f4f5",
  surfaceSecondary: "#1a1a1f",
  onSurfaceSecondary: "#d4d4d8",
  surfaceTertiary: "#26262c",
  onSurfaceTertiary: "#a1a1aa",
  surfaceInverse: "#f4f4f5",
  onSurfaceInverse: "#18181b",
  brand: "#a855f7",
  brandPrimary: "#a855f7",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#c084fc",
  brandTertiary: "#2c2140",
  onBrandTertiary: "#e9d5ff",
  success: "#22c55e",
  onSuccess: "#ffffff",
  warning: "#fbbf24",
  error: "#f87171",
  muted: "#8a8a93",
  border: "#2a2a30",
  borderStrong: "#3f3f46",
  divider: "#232327",
};

export type Palette = typeof lightColors;

// Backward-compatible default palette. Screens that haven't been migrated to the
// theme context still import `colors` and render in light mode (fully readable).
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  monoReg: "SpaceGrotesk-Regular",
  mono: "SpaceGrotesk-Medium",
  monoBold: "SpaceGrotesk-Bold",
};

export const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

export const shadowSoft = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};
