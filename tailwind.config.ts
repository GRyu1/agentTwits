import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fear: {
          900: '#040d1a',
          800: '#071428',
          700: '#0a1e3d',
          600: '#0d2b56',
          500: '#1a3a6e',
          400: '#2a5298',
          300: '#4a7fc0',
          200: '#7aaee0',
          100: '#b8d4f0',
        },
        greed: {
          900: '#1a0200',
          800: '#2d0500',
          700: '#4a0800',
          600: '#7a1000',
          500: '#b82200',
          400: '#e63200',
          300: '#ff5500',
          200: '#ff8c42',
          100: '#ffcba4',
        },
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out infinite',
        'shake-slow': 'shake 1.2s ease-in-out infinite',
        'pulse-red': 'pulse-red 1s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-in': 'slide-in 0.4s ease-out',
        'gauge-needle': 'gauge-needle 3s ease-in-out infinite',
        'glitch': 'glitch 0.3s ease-in-out infinite',
        'border-pulse': 'border-pulse 2s ease-in-out infinite',
        'text-flicker': 'text-flicker 2s linear infinite',
        'sweat-drop': 'sweat-drop 1.5s ease-in-out infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-2px) rotate(-0.5deg)' },
          '40%': { transform: 'translateX(2px) rotate(0.5deg)' },
          '60%': { transform: 'translateX(-1px)' },
          '80%': { transform: 'translateX(1px)' },
        },
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 10px #ff5500, 0 0 20px #ff3300' },
          '50%': { boxShadow: '0 0 25px #ff5500, 0 0 50px #ff3300, 0 0 80px #ff1100' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'glitch': {
          '0%': { textShadow: '2px 0 #ff0000, -2px 0 #00ffff' },
          '33%': { textShadow: '-2px 0 #ff0000, 2px 0 #00ffff' },
          '66%': { textShadow: '2px 2px #ff0000, -2px -2px #00ffff' },
          '100%': { textShadow: '0 0 transparent' },
        },
        'border-pulse': {
          '0%, 100%': { borderColor: 'rgba(255, 85, 0, 0.4)' },
          '50%': { borderColor: 'rgba(255, 85, 0, 1)' },
        },
        'text-flicker': {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.4' },
        },
        'sweat-drop': {
          '0%': { transform: 'translateY(-5px)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(5px)', opacity: '0' },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
