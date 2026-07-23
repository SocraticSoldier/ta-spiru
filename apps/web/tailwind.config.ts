import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          DEFAULT: '#1c1c1e',
          deep: '#111113',
        },
        bronze: {
          DEFAULT: '#b08d57',
          light: '#cfae7b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
