/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F5',
        ink: '#1C1B1A',
        indigoKaiwa: '#3B4CCA',
        vermilion: '#D9483B',
        matcha: '#2E7D5B',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
        jp: ['"Noto Sans JP"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
