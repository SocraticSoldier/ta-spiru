import { addMinutes, overlaps, zonedTimeToUtc } from './time.util';

describe('zonedTimeToUtc (Europe/Malta)', () => {
  it('converts winter wall-clock (CET, UTC+1) to UTC', () => {
    // 2026-01-15 09:00 Malta = 08:00 UTC
    expect(zonedTimeToUtc('2026-01-15', '09:00', 'Europe/Malta').toISOString()).toBe(
      '2026-01-15T08:00:00.000Z',
    );
  });

  it('converts summer wall-clock (CEST, UTC+2) to UTC', () => {
    // 2026-07-15 09:00 Malta = 07:00 UTC (DST in effect)
    expect(zonedTimeToUtc('2026-07-15', '09:00', 'Europe/Malta').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z',
    );
  });

  it('produces different UTC offsets across the DST boundary for the same wall-clock', () => {
    const winter = zonedTimeToUtc('2026-02-01', '12:00', 'Europe/Malta');
    const summer = zonedTimeToUtc('2026-08-01', '12:00', 'Europe/Malta');
    expect(winter.getUTCHours()).toBe(11); // UTC+1
    expect(summer.getUTCHours()).toBe(10); // UTC+2
  });
});

describe('addMinutes', () => {
  it('adds minutes without mutating the input', () => {
    const base = new Date('2026-07-15T07:00:00.000Z');
    const later = addMinutes(base, 45);
    expect(later.toISOString()).toBe('2026-07-15T07:45:00.000Z');
    expect(base.toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });

  it('crosses the hour and day boundary', () => {
    expect(addMinutes(new Date('2026-07-15T23:30:00.000Z'), 45).toISOString()).toBe(
      '2026-07-16T00:15:00.000Z',
    );
  });
});

describe('overlaps', () => {
  const t = (iso: string): Date => new Date(`2026-07-15T${iso}:00.000Z`);

  it('detects a partial overlap', () => {
    expect(overlaps(t('09:00'), t('10:00'), t('09:30'), t('10:30'))).toBe(true);
  });

  it('treats touching intervals as non-overlapping (end == start)', () => {
    // A cut ending at 09:45 and the next starting at 09:45 must both fit.
    expect(overlaps(t('09:00'), t('09:45'), t('09:45'), t('10:30'))).toBe(false);
  });

  it('detects full containment', () => {
    expect(overlaps(t('09:00'), t('11:00'), t('09:30'), t('10:00'))).toBe(true);
  });

  it('returns false for disjoint intervals', () => {
    expect(overlaps(t('09:00'), t('09:30'), t('10:00'), t('10:30'))).toBe(false);
  });
});
