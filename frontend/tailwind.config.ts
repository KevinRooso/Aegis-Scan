import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          500: "#5b6df7",
          600: "#3c4ad9",
        },
        aegis: {
          black: "#000000",
          red: "#FF3333",
          "red-glow": "rgba(255, 51, 51, 0.5)",
          "red-dim": "rgba(255, 51, 51, 0.2)",
          cyan: "#06b6d4",
          "cyan-bright": "#22d3ee",
          purple: "#a855f7",
        },
        cyber: {
          blue: "#00f0ff",
          green: "#00ff88",
          purple: "#b94eff",
          pink: "#ff006e",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-radial-at-t": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
        "gradient-radial-at-b": "radial-gradient(ellipse at bottom, var(--tw-gradient-stops))",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-out": "fadeOut 0.5s ease-out",
        "scale-in": "scaleIn 0.5s ease-out",
        "scan-line": "scanLine 3s linear infinite",
        "glow": "glow 2s ease-in-out infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": {
            opacity: "0.8",
            boxShadow: "0 0 30px rgba(255, 51, 51, 0.5)",
          },
          "50%": {
            opacity: "1",
            boxShadow: "0 0 60px rgba(255, 51, 51, 0.9)",
          },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
