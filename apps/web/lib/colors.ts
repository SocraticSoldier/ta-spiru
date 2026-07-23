import type { ServiceKindName } from '@ta-spiru/shared';

/** Service-stream accents: bronze for barbering, teal for detailing. */
export const KIND_COLORS: Record<ServiceKindName, { solid: string; soft: string; text: string }> = {
  BARBER: { solid: '#b08d57', soft: 'rgba(176,141,87,0.16)', text: '#cfae7b' },
  WASH: { solid: '#3fc1b0', soft: 'rgba(63,193,176,0.14)', text: '#7adccf' },
};

/** One hue per branch for the unified calendar. */
export const LOCATION_COLORS: Record<string, string> = {
  naxxar: '#e0b15e',
  pama: '#a78bfa',
  'san-gwann': '#38bdf8',
  fgura: '#f472b6',
  'san-giljan': '#34d399',
};

export const locationColor = (slug: string): string => LOCATION_COLORS[slug] ?? '#9ca3af';

/** Revenue-ledger accents: barbering bronze, detailing teal, retail amber/sky. */
export const LEDGER_COLORS: Record<string, { solid: string; soft: string; text: string }> = {
  BARBER_SERVICES: KIND_COLORS.BARBER,
  CAR_DETAILING: KIND_COLORS.WASH,
  RETAIL_BARBER: { solid: '#e0b15e', soft: 'rgba(224,177,94,0.14)', text: '#ecc987' },
  RETAIL_CAR_CARE: { solid: '#38bdf8', soft: 'rgba(56,189,248,0.12)', text: '#7dd3fc' },
};
