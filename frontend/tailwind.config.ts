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
        dark: {
          bg: "#0E1013",
          panel: "#14171B",
          panelElevated: "#1B1F24",
          border: "#262B31",
          borderSubtle: "#1B1F24",
          text: "#E6E8EB",
          muted: "#8A9099",
          dim: "#585F69",
        },
        light: {
          bg: "#F6F7F8",
          panel: "#FFFFFF",
          panelElevated: "#F1F3F5",
          border: "#DDE0E4",
          borderSubtle: "#E5E7EB",
          text: "#14171B",
          muted: "#606770",
        },
        brand: {
          DEFAULT: "#2DD4BF",
          dark: "#0F766E",
          hover: "#14B8A6",
          subtle: "rgba(45, 212, 191, 0.1)",
        },
        risk: {
          low: "#3B82F6",
          medium: "#F59E0B",
          high: "#EF4444",
          critical: "#DC2626",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
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
