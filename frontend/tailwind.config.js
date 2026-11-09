/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ipajm: {
          navy: '#0B2239',
          blue: '#1E40AF',
          sky: '#0284C7',
        }
      }
    },
  },
  plugins: [],
}
