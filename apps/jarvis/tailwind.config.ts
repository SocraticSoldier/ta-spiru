import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0A0C', 2: '#121218', 3: '#1A1A22' },
        edge: { DEFAULT: '#2C2C38', 2: '#3A3A48' },
        crimson: { DEFAULT: '#E01A2B', soft: 'rgba(224,26,43,.14)' },
        gold: { DEFAULT: '#E7B24C', soft: 'rgba(231,178,76,.12)' },
        ok: { DEFAULT: '#43B583', soft: 'rgba(67,181,131,.14)' },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
