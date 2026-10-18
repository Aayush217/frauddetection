import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        surfaceElevated: "#F1F5F9",
        borderSubtle: "#E2E8F0",
        borderStrong: "#CBD5E1",
        textPrimary: "#0F172A",
        textSecondary: "#475569",
        textTertiary: "#94A3B8",
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          DEFAULT: "#4F46E5",
        },
        risk: {
          low: "#059669",
          medium: "#D97706",
          high: "#DC2626",
          critical: "#B91C1C",
        },
        // Backwards compatibility aliases for existing components
        dark: {
          bg: "#F8FAFC",
          panel: "#FFFFFF",
          panelElevated: "#F8FAFC",
          border: "#E2E8F0",
          borderSubtle: "#F1F5F9",
          text: "#0F172A",
          muted: "#64748B",
          dim: "#94A3B8",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Inter'",
          "'Segoe UI'",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "'Fira Code'",
          "'IBM Plex Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        cardHover: "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        elevated: "0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      fontSize: {
        xxs: ["0.6875rem", { lineHeight: "0.875rem" }], // 11px
        xs: ["0.75rem", { lineHeight: "1rem" }],        // 12px
        sm: ["0.8125rem", { lineHeight: "1.125rem" }],  // 13px
        base: ["0.875rem", { lineHeight: "1.25rem" }],  // 14px
      },
    },
  },
  plugins: [],
};

export default config;
