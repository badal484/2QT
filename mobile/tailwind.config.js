/* eslint-disable */
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./App.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        2qt: {
          orange: "#FF6B35",
          "orange-dark": "#E55A2B",
          dark: "#1A1A2E",
          green: "#22C55E",
          red: "#EF4444",
          yellow: "#F59E0B",
        }
      }
    },
  },
}
