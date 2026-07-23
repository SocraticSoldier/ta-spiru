import { LedgerTag, PaymentChannel, TransactionStatus } from '@ta-spiru/database';

export interface SplitLedgerTagInput {
  tag: LedgerTag;
  amountCents: number;
  locationId?: string;
}

export interface CreatePaymentIntentInput {
  amountCents: number;
  currency?: string;
  channel: PaymentChannel;
  splitLedgerTags: readonly SplitLedgerTagInput[];
  customerId?: string;
  appointmentIds?: readonly string[];
  orderIds?: readonly string[];
}

export interface PaymentIntent {
  transactionId: string;
  paymentReference: string;
  /** Signed JWT consumed by the Trust Payments JS library / payment pages. */
  jwt: string;
  siteReference: string;
  amountCents: number;
  currency: string;
}

/** Claims payload required by Trust Payments' JWT-authenticated requests. */
export interface TrustPaymentsJwtClaims {
  payload: {
    accounttypedescription: 'ECOM' | 'MOTO';
    baseamount: string;
    currencyiso3a: string;
    sitereference: string;
    orderreference: string;
  };
}

export interface WebhookProcessingResult {
  transactionId: string;
  status: TransactionStatus;
  appointmentsConfirmed: number;
  ordersPaid: number;
  alreadyProcessed: boolean;
}
