/** Transport-safe mirrors of the Prisma enums for clients that must not depend on the Prisma runtime. */
export type RoleName =
  | 'ADMIN'
  | 'MANAGER'
  | 'RECEPTIONIST'
  | 'BARBER'
  | 'WASH_ATTENDANT'
  | 'CUSTOMER';

export type LedgerTagName =
  | 'BARBER_SERVICES'
  | 'CAR_DETAILING'
  | 'RETAIL_BARBER'
  | 'RETAIL_CAR_CARE';

/** One bookable "Combo Wash & Cut" slot returned by the availability engine. All timestamps are UTC ISO-8601. */
export interface ComboSlot {
  startsAt: string;
  barberEndsAt: string;
  washBayLockedUntil: string;
  barberId: string;
  barberName: string;
  washBayId: string;
  washBayName: string;
}

export interface PaymentIntentResponse {
  transactionId: string;
  paymentReference: string;
  jwt: string;
  siteReference: string;
  amountCents: number;
  currency: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  locationId: string | null;
}

export interface LocationSummary {
  id: string;
  slug: string;
  name: string;
  address: string;
  timezone: string;
  chairCount: number;
  bayCount: number;
}

export interface RevenueSplitLine {
  ledgerTag: LedgerTagName;
  amountCents: number;
  splitCount: number;
}

export interface RevenueSplitReport {
  from: string | null;
  to: string | null;
  totalCents: number;
  lines: RevenueSplitLine[];
}

export interface StockLevelRow {
  productId: string;
  sku: string;
  productName: string;
  brand: string | null;
  locationId: string;
  locationName: string;
  quantity: number;
  reorderThreshold: number;
  lowStock: boolean;
}

export interface TimeEntryRow {
  id: string;
  userId: string;
  staffName: string;
  role: RoleName;
  locationId: string;
  locationName: string;
  clockInAt: string;
  clockOutAt: string | null;
  workedMinutes: number | null;
}

export interface PunchResult {
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  entry: TimeEntryRow;
}

export interface PosCheckoutResponse {
  orderId: string;
  totalCents: number;
  paymentIntent: PaymentIntentResponse;
}
