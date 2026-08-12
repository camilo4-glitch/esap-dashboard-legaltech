/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0B2E6E',
        'navy-deep': '#071F4D',
        teal: '#1A7A6E',
        gold: '#C8970A',
        orange: '#C9611E',
        purple: '#6E56A6',
        blue: '#3E6FB0',
        gray: '#8C97A8',
        'gray-light': '#CBD5E1',
        bg: '#E7EDF6',
        card: '#F9FBFE',
        border: '#D6E0EE',
        ink: '#16213A',
        'ink-soft': '#5B6478',
        'ink-faint': '#8A93A6',
      }
    },
  },
  plugins: [],
}
