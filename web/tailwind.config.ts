import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#a855f7",
          primary: "#9333ea",
          secondary: "#c084fc",
          tertiary: "#f3e8ff",
          onTertiary: "#7e22ce",
        },
        ink: {
          DEFAULT: "#18181b",
          soft: "#27272a",
          muted: "#71717a",
        },
        line: "#e4e4e7",
        surface: {
          DEFAULT: "#ffffff",
          alt: "#f4f4f5",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-grotesk)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0,0,0,0.06)",
        card: "0 4px 16px rgba(0,0,0,0.08)",
        lift: "0 12px 32px rgba(0,0,0,0.12)",
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
