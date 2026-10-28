import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        ember: "var(--ember)",
        amber: "var(--amber)",
        sage: "var(--sage)",
        clay: "var(--clay)",
        line: "var(--line)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter-tight)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      fontSize: { "12": "12px", "14": "14px", "16": "16px", "20": "20px", "28": "28px", "40": "40px", "64": "64px", "96": "96px" },
      borderRadius: { card: "16px", nav: "12px" },
    },
  },
  plugins: [],
};
export default config;
