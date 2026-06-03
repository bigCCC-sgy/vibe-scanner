/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 24px 70px rgba(45, 52, 54, 0.16)',
        soft: '0 18px 45px rgba(45, 52, 54, 0.12)',
      },
      fontFamily: {
        display: ['Georgia', 'Songti SC', 'SimSun', 'serif'],
      },
    },
  },
  plugins: [],
}
