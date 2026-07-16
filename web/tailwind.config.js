/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        gradientShift: 'gradientShift 4s ease infinite',
      },
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
