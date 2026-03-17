import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0a0f1e",
          card: "#141b2d",
          light: "#1e2a45",
          border: "#2a3550",
        },
        gold: {
          DEFAULT: "#d4a843",
          light: "#e8c56d",
          dark: "#b8922e",
        },
        profit: "#10b981",
        loss: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
