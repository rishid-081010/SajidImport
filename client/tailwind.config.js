/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#040810',
          900: '#070e1c',
          850: '#0b1528',
          800: '#0f1d36',
          750: '#152644',
          700: '#1c3053',
          600: '#2a4470',
          500: '#3c5d94',
        },
        khaki: {
          300: '#d6cbba',
          400: '#c5b8a3',
          500: '#b7a990',
          600: '#9e9077',
          700: '#84815e',
          800: '#696748',
        },
        bone: {
          50: '#faf9f5',
          100: '#f3f1e8',
          200: '#e2e0cc',
          300: '#d2d0b8',
          400: '#bab89e',
        }
      },
      fontFamily: {
        serif: ['Cinzel', 'Playfair Display', 'Denton', 'Georgia', 'serif'],
        sans: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
