import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      // the footer scene (and the desktop spacing) kicks in from this width
      screens: { scene: "1200px" },
    },
  },
  plugins: [],
} satisfies Config;
