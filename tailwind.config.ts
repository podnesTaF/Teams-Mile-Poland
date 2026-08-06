import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        bg: "var(--color-bg)",
        "bg-2": "var(--color-bg-2)",
        "bg-3": "var(--color-bg-3)",
        ink: "var(--color-ink)",
        "ink-2": "var(--color-ink-2)",
        muted: "var(--color-muted)",
        "muted-2": "var(--color-muted-2)",
        line: "var(--color-line)",
        "line-2": "var(--color-line-2)",
        accent: "var(--color-accent)",
        "accent-hot": "var(--color-accent-hot)",
        "accent-soft": "var(--color-accent-soft)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        brand: {
          red: "#D23A33",
          "red-hot": "#E51F32",
          black: "#070707",
          white: "#FFFFFF",
        },
        // Admin token set (ADR 0004) — declared on `.admin-root` in
        // `src/app/admin.css` and only in scope under `/admin`. Values are
        // bare `var()`s, so the `/<alpha>` opacity modifier does not apply to
        // them; use a dedicated token (e.g. `admin-accent-soft`) instead.
        admin: {
          bg: "var(--admin-bg)",
          surface: "var(--admin-surface)",
          "surface-2": "var(--admin-surface-2)",
          line: "var(--admin-line)",
          "line-2": "var(--admin-line-2)",
          ink: "var(--admin-ink)",
          "ink-2": "var(--admin-ink-2)",
          muted: "var(--admin-muted)",
          accent: "var(--admin-accent)",
          "accent-soft": "var(--admin-accent-soft)",
          ok: "var(--admin-ok)",
          warn: "var(--admin-warn)",
          info: "var(--admin-info)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        "display-alt": ["var(--font-display-alt)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        eyebrow: ["11px", { lineHeight: "1.2", letterSpacing: "0.14em" }],
      },
      borderRadius: {
        none: "0",
        DEFAULT: "2px",
        sm: "2px",
        md: "2px",
        lg: "2px",
        pill: "9999px",
        // The public site is hard-edged at 2px; the admin panel is a tool, not
        // a poster, and reads better slightly softened (ADR 0004). Part of the
        // admin token set — `rounded-admin` on controls, `-lg` on panels.
        admin: "6px",
        "admin-lg": "10px",
      },
      boxShadow: {
        sm: "0 1px 2px rgb(7 7 7 / 0.04)",
        DEFAULT: "0 6px 18px -10px rgb(7 7 7 / 0.16), 0 1px 2px rgb(7 7 7 / 0.04)",
        lg: "0 30px 60px -20px rgb(7 7 7 / 0.25)",
      },
      maxWidth: {
        container: "1280px",
        prose: "65ch",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        spin: "spin 1.6s linear infinite",
      },
      transitionTimingFunction: {
        snappy: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
