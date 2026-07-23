export const colors = {
  ground: '#0e0e10',
  panel: '#1c1c1e',
  panelEdge: 'rgba(255,255,255,0.09)',
  bronze: '#b08d57',
  bronzeLight: '#cfae7b',
  wash: '#3fc1b0',
  washLight: '#7adccf',
  ink: '#f2f0ec',
  muted: 'rgba(242,240,236,0.55)',
  faint: 'rgba(242,240,236,0.32)',
  good: '#4ade80',
  danger: '#f87171',
} as const;

export type ServiceKind = 'BARBER' | 'WASH';

export const kindAccent = (kind: ServiceKind): { solid: string; soft: string; text: string } =>
  kind === 'BARBER'
    ? { solid: colors.bronze, soft: 'rgba(176,141,87,0.16)', text: colors.bronzeLight }
    : { solid: colors.wash, soft: 'rgba(63,193,176,0.14)', text: colors.washLight };

export const formatEuro = (cents: number): string => `€${(cents / 100).toFixed(2)}`;

export const formatTimeMalta = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-MT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Malta',
  });
