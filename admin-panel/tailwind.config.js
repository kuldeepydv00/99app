/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FF6B00",
        secondary: "#1A1A2E",
        accent: "#00D4AA",
        dark: "#0F0F1A",
      }
    },
  },
  plugins: [],
}
