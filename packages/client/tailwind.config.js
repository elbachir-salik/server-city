/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        city: {
          bg: '#0a0a0f',
          panel: 'rgba(10,12,20,0.85)',
          border: 'rgba(99,102,241,0.3)',
          accent: '#6366f1',
        },
      },
    },
  },
  plugins: [],
}
