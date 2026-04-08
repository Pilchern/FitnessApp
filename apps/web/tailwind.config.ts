import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        ember: "#C16630",
        sand: "#F4E6D1",
        mist: "#E8EEF2",
        pine: "#466362",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "\"Times New Roman\"", "serif"],
        body: ["\"Trebuchet MS\"", "\"Segoe UI\"", "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 60px -32px rgba(20, 33, 61, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
