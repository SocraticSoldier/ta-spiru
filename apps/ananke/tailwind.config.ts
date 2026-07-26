import type { Config } from 'tailwindcss';

/**
 * Palette sampled directly from the ΑΝΑΠΟΦΕΥΚΤΟΣ key art rather than guessed,
 * so the site and the artwork are the same brand.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The dusk gradient, top of frame to horizon.
        coral: {
          deep: '#ED9774',
          DEFAULT: '#FFA489',
          light: '#FEB8AB',
          blush: '#FECDC6',
        },
        // The figure: near-black carrying a cold navy lift.
        obsidian: {
          DEFAULT: '#0B0B14',
          lift: '#181830',
        },
        // The gilded spine.
        gilt: {
          DEFAULT: '#C9A66B',
          deep: '#8A6F3E',
        },
        ivory: '#FFF6F1',
      },
      fontFamily: {
        // GFS Didot is a Greek Didone, so the Greek wordmark keeps its
        // high-contrast cut instead of falling back to a Latin-only face.
        display: ['"GFS Didot"', '"Bodoni Moda"', 'Didot', '"Times New Roman"', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        wordmark: '0.18em',
      },
    },
  },
  plugins: [],
};

export default config;
