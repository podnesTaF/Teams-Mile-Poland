import type { Config } from "tailwindcss";

// UWAGA DLA ZESPOŁU FRONTENDOWEGO:
// Te tokeny zostały odtworzone na podstawie wizualnej obserwacji
// poland.acebattle.run (ciemne tło, agresywny pomarańczowo-czerwony akcent,
// złoty akcent dla puli nagród, szeroka wersalikowa typografia w nagłówkach).
// Nie mieliśmy dostępu do właściwego pliku tokenów/CSS produkcyjnego serwisu,
// więc przed wdrożeniem PROSIMY podmienić `colors.brand.*` na dokładne
// wartości z design systemu (Figma / globals.css głównej strony), aby 1:1
// odpowiadały marce.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0a0c10",
          bgElevated: "#14171d",
          bgCard: "#181b22",
          border: "rgba(255,255,255,0.08)",
          borderStrong: "rgba(255,255,255,0.16)",
          text: "#f5f4f0",
          textMuted: "#a3a8b3",
          accent: "#ff5522",
          accentHover: "#ff6f42",
          accentSoft: "rgba(255,85,34,0.12)",
          gold: "#ffc94d",
          success: "#33c17a",
          error: "#ff5470",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 20px 60px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(255,85,34,0.4), 0 0 40px -8px rgba(255,85,34,0.5)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #ff5522 0%, #ff8a3d 55%, #ffc94d 100%)",
        "brand-radial":
          "radial-gradient(60% 60% at 50% 0%, rgba(255,85,34,0.16) 0%, rgba(10,12,16,0) 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
