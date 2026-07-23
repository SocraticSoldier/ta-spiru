/** Minutes a wash bay stays locked beyond the barber appointment in a combo booking. */
export const COMBO_WASH_BUFFER_MIN = 30;

/** Granularity of bookable slot starts. */
export const SLOT_STEP_MIN = 15;

export const DEFAULT_CURRENCY = 'EUR' as const;

export const BRANCHES = [
  { slug: 'naxxar', name: 'Naxxar', descriptor: 'Flagship Barbershop & Detailing Hub' },
  { slug: 'pama', name: 'Pama', descriptor: 'Shopping Complex Barbershop & Wash Bay' },
  { slug: 'san-gwann', name: 'San Ġwann', descriptor: 'Barbershop' },
  { slug: 'fgura', name: 'Fgura', descriptor: 'Barbershop' },
  { slug: 'san-giljan', name: "San Ġiljan – St George's Mall", descriptor: 'Premium Location' },
] as const;

export type BranchSlug = (typeof BRANCHES)[number]['slug'];
