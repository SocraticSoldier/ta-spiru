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

/** A branch's clockable staff for the in-store kiosk grid. */
export interface KioskStaffMember {
  id: string;
  name: string;
  role: RoleName;
  hasPin: boolean;
  clockedIn: boolean;
  clockedInSince: string | null;
}

export interface PosCheckoutResponse {
  orderId: string;
  totalCents: number;
  paymentIntent: PaymentIntentResponse;
}

export type ServiceKindName = 'BARBER' | 'WASH';

export type QueueStatusName = 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'LEFT';

export interface QueueEntryView {
  id: string;
  displayName: string;
  serviceName: string;
  serviceKind: ServiceKindName;
  status: QueueStatusName;
  vehicleReg: string | null;
  joinedAt: string;
  /** 1-based position among WAITING entries of the same service kind; null once called. */
  position: number | null;
  estimatedWaitMin: number | null;
}

export interface QueueSnapshot {
  locationId: string;
  locationName: string;
  generatedAt: string;
  entries: QueueEntryView[];
}

/** Redis / WebSocket event emitted whenever a location's queue changes. */
export interface QueueUpdatedEvent extends Record<string, unknown> {
  type: 'queue.updated';
  snapshot: QueueSnapshot;
}

export interface UpsellSuggestion {
  serviceId: string;
  serviceName: string;
  priceCents: number;
  durationMin: number;
  reason: string;
}

export interface JoinQueueResponse {
  entry: QueueEntryView;
  upsell: UpsellSuggestion | null;
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  barberId: string | null;
  barberName: string | null;
  resourceId: string | null;
  resourceName: string | null;
}

export interface AppointmentRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  customerName: string;
  serviceName: string;
  serviceKind: ServiceKindName;
  barberName: string | null;
  resourceName: string | null;
  comboGroupId: string | null;
}

export type SeniorityName = 'JUNIOR' | 'NORMAL' | 'SENIOR';

export interface ServiceTierSummary {
  seniority: SeniorityName;
  priceCents: number;
  durationMin: number;
}

export interface ServiceSummary {
  id: string;
  slug: string;
  name: string;
  kind: ServiceKindName;
  durationMin: number;
  priceCents: number;
  isComboEligible: boolean;
  /** Price is given on inspection (e.g. ceramic coating); priceCents is 0. */
  isQuoteOnly: boolean;
  /** Junior/Normal/Senior price bands for barber haircuts (empty otherwise). */
  tiers: ServiceTierSummary[];
  description: string | null;
  photoUrl: string | null;
}

/** A barber for the customer-facing booking screen. */
export interface BarberSummary {
  id: string;
  firstName: string;
  lastName: string;
  seniority: SeniorityName | null;
  stationNo: number | null;
  photoUrl: string | null;
}

export type WaitingListStatusName = 'WAITING' | 'OFFERED' | 'BOOKED' | 'CANCELLED';

/** A customer waiting for a fully-booked barber on a given day. */
export interface WaitingListRow {
  id: string;
  locationId: string;
  customerName: string;
  customerPhone: string | null;
  barberId: string | null;
  barberName: string | null;
  serviceId: string;
  serviceName: string;
  forDate: string;
  status: WaitingListStatusName;
  notes: string | null;
  createdAt: string;
}

/**
 * A client visit on the barber's own kiosk. By policy the barber sees ONLY the
 * client's name and the requested services — no contact details, notes or price.
 */
export interface BarberScheduleRow {
  /** The visit's primary appointment — use for status changes. */
  id: string;
  /** The latest segment in the visit — use for add-service so it appends at the true end. */
  lastAppointmentId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  clientName: string;
  services: string[];
}

/** A service as offered by a specific barber, with price/duration resolved. */
export interface BarberServiceSummary {
  serviceId: string;
  slug: string;
  name: string;
  kind: ServiceKindName;
  priceCents: number;
  durationMin: number;
  maxDaily: number | null;
  isComboEligible: boolean;
  description: string | null;
  photoUrl: string | null;
}

export type LoyaltyTierName = 'BRONZE' | 'SILVER' | 'GOLD';

export interface LoyaltyLedgerLine {
  id: string;
  kind: 'EARN' | 'REDEEM' | 'ADJUST';
  deltaPoints: number;
  note: string | null;
  createdAt: string;
}

export interface LoyaltySummary {
  balancePoints: number;
  lifetimePoints: number;
  tier: LoyaltyTierName;
  recentEntries: LoyaltyLedgerLine[];
}

/** Payload consumed by the wallet-pass generator and the QR renderer in the apps. */
export interface LoyaltyPass {
  walletPassToken: string;
  qrPayload: string;
  tier: LoyaltyTierName;
  balancePoints: number;
  displayName: string;
}

export interface LoyaltyScanResult {
  accountId: string;
  customerName: string;
  tier: LoyaltyTierName;
  balancePoints: number;
  lifetimePoints: number;
  /** Gates the internal staff discount at the till — a normal card is false. */
  isTaSpiruStaff: boolean;
}

export interface TransactionRow {
  id: string;
  paymentReference: string;
  transactionReference: string | null;
  status: string;
  channel: string;
  amountCents: number;
  currency: string;
  customerName: string | null;
  createdAt: string;
  settledAt: string | null;
  splits: { ledgerTag: LedgerTagName; amountCents: number }[];
}

export interface OrderRow {
  id: string;
  channel: string;
  status: string;
  totalCents: number;
  locationName: string;
  createdAt: string;
  items: { productName: string; quantity: number; unitPriceCents: number }[];
}

export interface EcomCheckoutResponse {
  orderId: string;
  totalCents: number;
  paymentIntent: PaymentIntentResponse;
}

/** Admin-managed unavailability window; barberId null blocks the whole location. */
export interface TimeBlockRow {
  id: string;
  locationId: string;
  barberId: string | null;
  barberName: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  role: RoleName;
  locationId: string | null;
}

export interface MyBookingRow {
  id: string;
  comboGroupId: string | null;
  locationName: string;
  serviceName: string;
  serviceKind: ServiceKindName;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  status: string;
  barberName: string | null;
  resourceName: string | null;
  vehicleReg: string | null;
}

export interface BookingConfirmation {
  status: 'booked';
  appointmentIds: string[];
  comboGroupId: string | null;
  startsAt: string;
  amountCents: number;
  paymentReference: string;
}
