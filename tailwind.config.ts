import type { Config } from "tailwindcss";

// Ortomed brand color — change here to re-theme the whole app.
const brand = {
  DEFAULT: "#4A7C8C",
  50: "#EEF4F5",
  100: "#DCE9EC",
  200: "#B9D3D9",
  300: "#96BDC6",
  400: "#73A7B3",
  500: "#4A7C8C",
  600: "#3B6470",
  700: "#2D4B54",
  800: "#1E3238",
  900: "#0F191C",
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand,
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
