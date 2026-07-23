const euroFormatter = new Intl.NumberFormat('en-MT', {
  style: 'currency',
  currency: 'EUR',
});

export const formatEuro = (cents: number): string => euroFormatter.format(cents / 100);

export const LEDGER_TAG_LABELS: Record<string, string> = {
  BARBER_SERVICES: 'Barber Services',
  CAR_DETAILING: 'Car Detailing',
  RETAIL_BARBER: 'Retail — Barber',
  RETAIL_CAR_CARE: 'Retail — Car Care',
};
