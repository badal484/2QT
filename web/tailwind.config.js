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
        'brand-primary': '#00C853',
        'brand-primary-dark': '#00A344',
        'brand-accent': '#E8F5E9',
        'brand-dark': '#111111',
        'brand-light': '#FAFAFA',
        // Keeping legacy aliases for safety during transition
        'swish-green': '#00C853',
        'swish-green-dark': '#00A344',
      },
    },
  },
  plugins: [],
}
