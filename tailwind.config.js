/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary: deep teal/forest green family
        teal: {
          50:  '#f0faf9',
          100: '#d9f2ef',
          200: '#b3e4de',
          300: '#7dcec6',
          400: '#45b0a7',
          500: '#2a948c',
          600: '#1e7870',
          700: '#195f59',
          800: '#174d48',
          900: '#14403c',
          950: '#0a2624',
        },
        // Sage accents
        sage: {
          50:  '#f4f7f4',
          100: '#e5ede5',
          200: '#ccdacc',
          300: '#a8bfa8',
          400: '#7d9e7e',
          500: '#5d7f5e',
          600: '#496549',
          700: '#3b503c',
          800: '#314132',
          900: '#293629',
        },
        // Warm ivory / champagne backgrounds
        ivory: {
          50:  '#fdfcf8',
          100: '#faf7ef',
          200: '#f5eedc',
          300: '#ece0c4',
          400: '#deccaa',
          500: '#cbb88e',
          600: '#b89d72',
          700: '#9a7f5a',
          800: '#7d674b',
          900: '#67553e',
        },
        // Charcoal text
        charcoal: {
          50:  '#f0f0f0',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#3d3d3d',
          900: '#2a2a2a',
          950: '#1a1a1a',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft':    '0 2px 12px 0 rgba(0,0,0,0.06)',
        'medium':  '0 4px 24px 0 rgba(0,0,0,0.09)',
        'strong':  '0 8px 40px 0 rgba(0,0,0,0.13)',
        'card':    '0 1px 4px 0 rgba(0,0,0,0.05), 0 4px 16px 0 rgba(0,0,0,0.07)',
      },
      borderRadius: {
        'xl':  '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                         to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' },                   '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
}
