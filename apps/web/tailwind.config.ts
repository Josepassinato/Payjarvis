import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f0f",
          card: "#1a1a1a",
          hover: "#252525",
          border: "#2a2a2a",
        },
        approved: "#22c55e",
        blocked: "#ef4444",
        pending: "#eab308",
        brand: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
