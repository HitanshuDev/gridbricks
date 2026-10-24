/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16251f",
        muted: "#75817b",
        canvas: "#f6f8f7",
        line: "#e8eeea",
        forest: "#157453",
        mint: "#e8f4ee",
        amber: "#a9651a",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 2px 12px rgba(22, 37, 31, .035)",
      },
    },
  },
  plugins: [],
};
