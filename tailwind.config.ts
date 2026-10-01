import path from "node:path";
import type { Config } from "tailwindcss";

/**
 * GIO4X design tokens → Tailwind.
 *
 * Spacing is a Fibonacci scale (φ rhythm): the class number is the pixel
 * value at the default root size, expressed in rem so it scales with the
 * visitor's text-size preference. `p-21` = 21px, `gap-34` = 34px.
 * Colours are never hard-coded here: every entry resolves to a CSS variable
 * defined in src/styles/tokens.css so light / dark / accent palettes work.
 */
const rem = (px: number) => `${px / 16}rem`;

const config: Config = {
  // absolute and forward-slashed so it resolves whatever the process cwd is
  content: [path.join(__dirname, "src/**/*.{ts,tsx}").replace(/\\/g, "/")],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    spacing: {
      0: "0",
      px: "1px",
      1: rem(1),
      2: rem(2),
      3: rem(3),
      5: rem(5),
      8: rem(8),
      13: rem(13),
      21: rem(21),
      34: rem(34),
      55: rem(55),
      89: rem(89),
      144: rem(144),
      233: rem(233),
      gutter: "var(--gutter)",
    },
    borderRadius: {
      none: "0",
      xs: "2px",
      sm: "3px",
      DEFAULT: "5px",
      md: "8px",
      full: "9999px",
    },
    fontFamily: {
      sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      display: ["var(--font-norms)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
    },
    fontSize: {
      micro: [rem(11), { lineHeight: "1.45", letterSpacing: "0.08em" }],
      xs: [rem(12), { lineHeight: "1.5" }],
      sm: [rem(14), { lineHeight: "1.55" }],
      base: [rem(16), { lineHeight: "1.618" }],
      md: [rem(18), { lineHeight: "1.618" }],
      lg: [rem(21), { lineHeight: "1.5" }],
      xl: [rem(26), { lineHeight: "1.35" }],
      "2xl": [rem(34), { lineHeight: "1.22" }],
      "3xl": [rem(43), { lineHeight: "1.14" }],
      "4xl": [rem(55), { lineHeight: "1.08" }],
      "5xl": [rem(70), { lineHeight: "1.04" }],
      "6xl": [rem(89), { lineHeight: "1" }],
    },
    screens: {
      sm: "560px",
      md: "820px",
      lg: "1080px",
      xl: "1320px",
      "2xl": "1720px",
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#fff",
      bg: "var(--bg)",
      paper: "var(--paper)",
      surface: "var(--surface)",
      "surface-2": "var(--surface-2)",
      sunken: "var(--sunken)",
      ink: "var(--ink)",
      "ink-2": "var(--ink-2)",
      "ink-3": "var(--ink-3)",
      line: "var(--line)",
      "line-strong": "var(--line-strong)",
      brand: "var(--brand)",
      "brand-ink": "var(--brand-ink)",
      "brand-soft": "var(--brand-soft)",
      teal: "var(--teal)",
      emerald: "var(--emerald)",
      platinum: "var(--platinum)",
      prestige: "var(--prestige)",
      "prestige-ink": "var(--prestige-ink)",
      accent: "var(--accent)",
      "accent-ink": "var(--accent-ink)",
      pos: "var(--pos)",
      neg: "var(--neg)",
      neutral: "var(--neutral)",
      info: "var(--info)",
      warn: "var(--warn)",
      night: "var(--night)",
      "night-2": "var(--night-2)",
      "on-night": "var(--on-night)",
      "on-night-2": "var(--on-night-2)",
      "night-line": "var(--night-line)",
    },
    boxShadow: {
      none: "none",
      1: "var(--elev-1)",
      2: "var(--elev-2)",
      3: "var(--elev-3)",
      focus: "0 0 0 3px var(--focus)",
    },
    transitionDuration: {
      instant: "100ms",
      fast: "160ms",
      DEFAULT: "260ms",
      slow: "420ms",
      reveal: "680ms",
      cinematic: "1100ms",
    },
    transitionTimingFunction: {
      DEFAULT: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      out: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      inout: "cubic-bezier(0.65, 0, 0.35, 1)",
      linear: "linear",
    },
    zIndex: {
      0: "0",
      1: "1",
      2: "2",
      header: "40",
      overlay: "60",
      modal: "70",
      toast: "80",
    },
    extend: {
      maxWidth: {
        page: "var(--page)",
        measure: "68ch",
        narrow: "48ch",
      },
      gridTemplateColumns: {
        phi: "minmax(0,1.618fr) minmax(0,1fr)",
        "phi-r": "minmax(0,1fr) minmax(0,1.618fr)",
      },
      aspectRatio: {
        phi: "1.618 / 1",
        "phi-tall": "1 / 1.618",
      },
    },
  },
  plugins: [],
};

export default config;
