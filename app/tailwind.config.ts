import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0A0E27",
        gold: "#D4AF37",
        gunmetal: "#2A2F4F",
        charcoal: "#1A1F3A",
        offwhite: "#F5F5F5",
        success: "#2ECC71",
        warning: "#F39C12",
        error: "#E74C3C",
        pending: "#95A5A6",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "2px",
        md: "4px",
        lg: "4px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "4px",
        full: "9999px",
      },
      boxShadow: {
        none: "0 0 #0000",
      },
      screens: {
        sm: "320px",
        md: "431px",
        lg: "769px",
        xl: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
