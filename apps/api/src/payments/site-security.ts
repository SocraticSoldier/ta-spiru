import { createHash, timingSafeEqual } from 'node:crypto';

export interface SiteSecurityFields {
  errorcode: string;
  orderreference: string;
  settlestatus?: string;
  sitereference: string;
  transactionreference: string;
}

/**
 * Trust Payments URL-notification site-security digest. The field order MUST
 * mirror the response-site-security configuration in the MyST portal.
 */
export const computeSiteSecurity = (fields: SiteSecurityFields, password: string): string => {
  const digestInput = [
    fields.errorcode,
    fields.orderreference,
    fields.settlestatus ?? '',
    fields.sitereference,
    fields.transactionreference,
    password,
  ].join('');
  return createHash('sha256').update(digestInput, 'utf8').digest('hex');
};

/** Constant-time comparison of two hex digests. */
export const digestsMatch = (expectedHex: string, providedHex: string): boolean => {
  const expected = Buffer.from(expectedHex.toLowerCase(), 'utf8');
  const provided = Buffer.from(providedHex.toLowerCase(), 'utf8');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
};
