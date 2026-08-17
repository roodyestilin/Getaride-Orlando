import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { lightColors, darkColors, Palette } from "./theme";
import { storage } from "./utils/storage";

const STORAGE_KEY = "theme_mode";

interface ThemeContextValue {
  isDark: boolean;
  colors: Palette;
  setDark: (v: boolean) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightColors,
  setDark: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState<boolean>(() => Appearance.getColorScheme() === "dark");

  useEffect(() => {
    storage
      .getItem(STORAGE_KEY, "")
      .then((v) => {
        if (v === "dark") setDark(true);
        else if (v === "light") setDark(false);
      })
      .catch(() => {});
  }, []);

  const applyDark = useCallback((v: boolean) => {
    setDark(v);
    storage.setItem(STORAGE_KEY, v ? "dark" : "light").catch(() => {});
  }, []);

  const toggle = useCallback(() => applyDark(!dark), [applyDark, dark]);

  const colors = dark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ isDark: dark, colors, setDark: applyDark, toggle }),
    [dark, colors, applyDark, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Build a themed StyleSheet: const styles = useThemedStyles(makeStyles) */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors]);
}
