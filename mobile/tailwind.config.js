/* eslint-disable */
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./App.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "2qt": {
          primary: "#1B5E46",
          "primary-dark": "#123F30",
          "primary-tint": "#E8F2EC",
          accent: "#D97B4F",
          "accent-tint": "#FBEAE0",
          ink: "#1A1F1C",
          green: "#1B5E46",
          red: "#B5453B",
          yellow: "#B8853B",
        }
      },
      fontFamily: {
        regular: ["Inter-Regular"],
        medium: ["Inter-Medium"],
        semibold: ["Inter-SemiBold"],
        bold: ["Inter-Bold"],
        extrabold: ["Inter-ExtraBold"],
        black: ["Inter-Black"],
      }
    },
  },
}
