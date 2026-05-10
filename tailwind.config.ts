import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "#1B4F72",
          foreground: "#ffffff",
        },
        danger: "#E74C3C",
        safe: "#27AE60",
        warning: "#F39C12",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "Arial", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "Arial", "sans-serif"],
      },
      boxShadow: {
        panel: "0 14px 40px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
