import { createHash } from 'node:crypto';
import { computeSiteSecurity, digestsMatch, SiteSecurityFields } from './site-security';

const PASSWORD = 'webhook-secret';
const fields: SiteSecurityFields = {
  errorcode: '0',
  orderreference: 'order-123',
  settlestatus: '100',
  sitereference: 'test_taspiru',
  transactionreference: 'tx-456',
};

describe('computeSiteSecurity', () => {
  it('hashes fields in the MyST field order + password', () => {
    const expected = createHash('sha256')
      .update('0order-123100test_taspirutx-456webhook-secret', 'utf8')
      .digest('hex');
    expect(computeSiteSecurity(fields, PASSWORD)).toBe(expected);
  });

  it('treats a missing settlestatus as empty string', () => {
    const withEmpty = computeSiteSecurity({ ...fields, settlestatus: undefined }, PASSWORD);
    const explicit = createHash('sha256')
      .update('0order-123test_taspirutx-456webhook-secret', 'utf8')
      .digest('hex');
    expect(withEmpty).toBe(explicit);
  });

  it('changes when any field changes (tamper detection)', () => {
    const baseline = computeSiteSecurity(fields, PASSWORD);
    expect(computeSiteSecurity({ ...fields, errorcode: '1' }, PASSWORD)).not.toBe(baseline);
    expect(computeSiteSecurity({ ...fields, orderreference: 'x' }, PASSWORD)).not.toBe(baseline);
    expect(computeSiteSecurity(fields, 'wrong-password')).not.toBe(baseline);
  });
});

describe('digestsMatch', () => {
  it('matches identical digests case-insensitively', () => {
    const digest = computeSiteSecurity(fields, PASSWORD);
    expect(digestsMatch(digest, digest.toUpperCase())).toBe(true);
  });

  it('rejects a mismatched digest', () => {
    const good = computeSiteSecurity(fields, PASSWORD);
    const bad = computeSiteSecurity({ ...fields, errorcode: '1' }, PASSWORD);
    expect(digestsMatch(good, bad)).toBe(false);
  });

  it('rejects a length mismatch without throwing', () => {
    expect(digestsMatch(computeSiteSecurity(fields, PASSWORD), 'short')).toBe(false);
  });
});
