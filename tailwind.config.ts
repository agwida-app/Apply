import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-tajawal)", "system-ui", "sans-serif"] },
      colors: {
        // بنفسجي هادئ مريح للعين
        brand: {
          50: "#f4f2ff", 100: "#ebe7ff", 200: "#d8d0fe", 300: "#bbadfb", 400: "#9a85f6",
          500: "#7d63ee", 600: "#6a4ee0", 700: "#5a3fc4", 800: "#4a349e", 900: "#3d2d7e",
        },
      },
      boxShadow: { soft: "0 1px 2px rgba(16,24,40,.04), 0 2px 8px rgba(16,24,40,.04)" },
    },
  },
  plugins: [],
} satisfies Config;
