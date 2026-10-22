import type { Config } from "tailwindcss";

// Match the TENZIA /pages/zamena storefront form.
const brand = {
  DEFAULT: "#000000",
  50: "#FFFFFF",
  100: "#F3F4F6",
  200: "#D5D5D5",
  300: "#B8B8B8",
  400: "#767676",
  500: "#000000",
  600: "#414141",
  700: "#000000",
  800: "#000000",
  900: "#000000",
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand,
        gray: {
          200: "#D5D5D5",
          400: "#999999",
          500: "#767676",
          600: "#000000",
          700: "#000000",
          800: "#000000",
          900: "#000000",
        },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
