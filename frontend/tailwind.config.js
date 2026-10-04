/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080b12',
        panel: '#0f141d',
        line: '#252d3b',
        mint: '#64f0c2',
      },
      boxShadow: {
        glow: '0 0 45px rgba(100, 240, 194, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.75)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'pulse-dot': 'pulseDot 1.3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
