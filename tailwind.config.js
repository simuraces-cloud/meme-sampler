/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f7fb',
          100: '#eeeef4',
          200: '#d6d6e2',
          300: '#a7a7bd',
          400: '#6f6f8a',
          500: '#3d3d57',
          600: '#272740',
          700: '#1a1a2e',
          800: '#11111f',
          900: '#08081a',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pad-pop': 'pad-pop 180ms ease-out',
      },
      keyframes: {
        'pad-pop': {
          '0%': { transform: 'scale(0.92)', filter: 'brightness(1.6)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
      },
    },
  },
  plugins: [],
}
