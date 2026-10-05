/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070a10',
        panel: '#0d121a',
        line: '#232c39',
        mint: '#64f0c2',
      },
      boxShadow: {
        floating: '0 24px 70px rgba(0, 0, 0, 0.28)',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', 'Aptos', '"Segoe UI"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Code"', '"SFMono-Regular"', 'ui-monospace', 'monospace'],
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
        'fade-up': 'fade-up .24s cubic-bezier(.23,1,.32,1) both',
        'pulse-dot': 'pulseDot 1.3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
