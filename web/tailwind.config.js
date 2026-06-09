/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#FF6B35',
        'brand-primary-dark': '#E55A2A',
        'brand-accent': '#F4D35E',
        'brand-dark': '#1A1A1A',
        'brand-light': '#FAFAFA',
        // Keeping legacy aliases for safety during transition
        'swish-green': '#FF6B35',
        'swish-green-dark': '#E55A2A',
      },
    },
  },
  plugins: [],
}
