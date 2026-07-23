import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          DEFAULT: '#1c1c1e',
          deep: '#0e0e10',
        },
        bronze: {
          DEFAULT: '#b08d57',
          light: '#cfae7b',
        },
        wash: {
          DEFAULT: '#3fc1b0',
          light: '#7adccf',
        },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Brewheat', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
