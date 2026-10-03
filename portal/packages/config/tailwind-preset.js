/** @type {import('tailwindcss').Config} */
// Brand tokens cloned from GIO4X NEW so the new monorepo stays visually
// continuous with the marketing site. Treat this file as the source of truth.
// Light mode only — dark theme support intentionally removed.
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B3A6B",
          dark: "#0F2347",
        },
        sky: {
          DEFAULT: "#29ABE2",
          light: "#5BCBF5",
          glow: "rgba(41,171,226,0.15)",
        },
        steel: {
          DEFAULT: "#6D6E71",
          light: "#A0A2A5",
        },
        surface: {
          dark: "#111827",
          light: "#FFFFFF",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        glass: "16px",
      },
      maxWidth: {
        site: "1280px",
      },
    },
  },
  plugins: [],
};
