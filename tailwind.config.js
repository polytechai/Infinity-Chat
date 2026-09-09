/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        infinity: {
          dark: "#0a0d14",
          surface: "#121826",
          card: "#1b2236",
          border: "#29334d",
          primary: "#6366f1",
          primaryHover: "#4f46e5",
          secondary: "#06b6d4",
          accent: "#ec4899",
          vanish: "#a855f7"
        }
      },
      animation: {
        pulseFast: "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        wave: "wave 1.5s ease-in-out infinite"
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1.0)" }
        }
      }
    }
  },
  plugins: []
};
