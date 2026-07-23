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
