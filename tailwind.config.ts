import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4A017",
          50: "#FDF8E7",
          100: "#FAEFCE",
          200: "#F5DF9D",
          300: "#EFCF6C",
          400: "#E9BF3C",
          500: "#D4A017",
          600: "#A87F12",
          700: "#7C5E0D",
          800: "#503E09",
          900: "#241F04"
        },
        bg: {
          DEFAULT: "#080808",
          50: "#262626",
          100: "#1F1F1F",
          200: "#181818",
          300: "#121212",
          400: "#0C0C0C",
          500: "#080808",
          600: "#050505",
          700: "#030303",
          800: "#020202",
          900: "#010101"
        },
        surface: {
          DEFAULT: "#111111",
          muted: "#1A1A1A",
          elevated: "#1F1F1F"
        },
        border: {
          DEFAULT: "#2A2A2A",
          muted: "#1F1F1F"
        }
      },
      fontFamily: {
        heading: ["var(--font-cinzel)", "Cinzel", "serif"],
        sans: ["var(--font-raleway)", "Raleway", "system-ui", "sans-serif"]
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(212,160,23,0.35), 0 10px 40px -10px rgba(212,160,23,0.25)"
      },
      keyframes: {
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.65" }
        }
      },
      animation: {
        "pulse-soft": "pulseSoft 2.2s ease-in-out infinite"
      }
    }
  },
  plugins: [typography]
};

export default config;
