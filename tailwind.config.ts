import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-tajawal)", "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#eef6ff", 100: "#d9eaff", 200: "#bcdaff", 300: "#8ec3ff", 400: "#59a2ff",
          500: "#337fff", 600: "#1b5ff5", 700: "#144ae1", 800: "#173db6", 900: "#19388f",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
