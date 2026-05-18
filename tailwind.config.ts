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
        "certify-blue":      "#388fa6",  // primary blue-teal
        "certify-deep":      "#2b4044",  // dark text
        "certify-light":     "#e8f3fa",  // light blue background
        "certify-medium":    "#5fa8bb",  // mid blue / hover
        "certify-white":     "#e8e5e0",  // warm off-white
        "certify-cool-grey": "#7a8f94",  // muted text
        "certify-dark-grey": "#4a6570",  // secondary text
        "certify-beige":     "#f9f5ef",  // warm beige
        "certify-teal":      "#1c5e70",  // deep teal
        "certify-navy":      "#1a3a44",  // near-black teal-navy
        "certify-sand":      "#edc299",  // warm sand
        "certify-sage":      "#a3bfa1",  // sage green (WELL chips)
      },
      fontFamily: {
        serif: ["var(--font-dm-serif)", "Georgia", "serif"],
        sans:  ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #12424a 0%, #2b4044 50%, #1c5e70 100%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(56,143,166,0.15) 0%, rgba(28,94,112,0.05) 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "count-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up":   "fade-up 0.6s ease-out forwards",
        "fade-in":   "fade-in 0.4s ease-out forwards",
        "count-up":  "count-up 0.5s ease-out forwards",
      },
      boxShadow: {
        "glass": "0 4px 24px rgba(18, 66, 74, 0.12), 0 1px 4px rgba(18, 66, 74, 0.08)",
        "card":  "0 2px 16px rgba(43, 64, 68, 0.10)",
        "hero":  "0 24px 80px rgba(18, 66, 74, 0.30)",
      },
    },
  },
  plugins: [],
};

export default config;
