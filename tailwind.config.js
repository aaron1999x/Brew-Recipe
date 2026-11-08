/** @type {import('tailwindcss').Config} */
const sf = ['"Bricolage Grotesque"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'];

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral surfaces. Higher number = the "base" layer (page / inset panels); lower = raised.
        mist: {
          950: '#F5F5F7', // page background, inset panels
          900: '#FFFFFF', // cards
          850: '#FFFFFF',
          800: '#EFEFF2', // hover, tracks, subtle fills
          700: '#E5E5EA', // hairline borders
          600: '#D2D2D7', // input borders
          500: '#AEAEB2',
        },
        ink: {
          DEFAULT: '#1D1D1F',
          muted: '#6E6E73',
          faint: '#86868B',
        },
        accent: {
          DEFAULT: '#007A87', // CAFEC Flower dripper teal (5.1:1 with white text)
          soft: '#006D79',
          deep: '#00636E',
        },
        // "changed vs recipe" highlight
        flag: {
          DEFAULT: '#F08C00',
          soft: '#B25E00',
          deep: '#8F4A00',
        },
        ok: '#248A3D',
        warn: '#B25E00',
        bad: '#D70015',
      },
      fontFamily: {
        display: sf,
        sans: sf,
        // Numbers use the same family with tabular figures (see index.css), Apple-style.
        mono: sf,
      },
      boxShadow: {
        glow: '0 0 0 4px rgba(0,122,135,0.14)',
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
