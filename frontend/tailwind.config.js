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
        brand: {
          yellow: '#FACC15',
          DEFAULT: '#FACC15',
          dark: '#EAB308',
        },
        slate: {
          heading: '#1E293B',
          secondary: '#64748B',
        },
        app: {
          bg: '#F3F4F6',
          card: '#FFFFFF',
        },
        status: {
          success: '#22C55E',
          danger: '#EF4444',
        }
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}
