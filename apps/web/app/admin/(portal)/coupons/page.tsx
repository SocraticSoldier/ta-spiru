import type { JSX } from 'react';
import type { LocationSummary } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { formatEuro } from '@/lib/format';
import { createCoupon, toggleCoupon } from './actions';
import { requireRole } from '@/lib/require-role';

interface CouponRow {
  id: string;
  code: string;
  kind: 'PERCENT' | 'AMOUNT';
  value: number;
  validFrom: string | null;
  validUntil: string | null;
  locationId: string | null;
  customerId: string | null;
  customerName: string | null;
  lowPeakOnly: boolean;
  maxRedemptions: number | null;
  redemptions: number;
  isActive: boolean;
  notes: string | null;
  isBirthdayReward: boolean;
}

const CouponsPage = async (): Promise<JSX.Element> => {
  // Discounts change what customers pay.
  await requireRole('ADMIN', 'MANAGER');

  let coupons: CouponRow[] = [];
  let locations: LocationSummary[] = [];
  try {
    [coupons, locations] = await Promise.all([
      apiFetch<CouponRow[]>('/coupons'),
      apiFetch<LocationSummary[]>('/locations'),
    ]);
  } catch {
    coupons = [];
  }
  const locationName = (id: string | null): string => locations.find((l) => l.id === id)?.name ?? 'All branches';

  return (
    <section>
      <h1 className="text-4xl">Coupons</h1>
      <p className="mt-2 text-sm text-white/50">Discount codes, gift vouchers and per-customer perks.</p>

      <div className="mt-8 flex flex-col gap-2.5">
        {coupons.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
            No coupons yet — create one below.
          </p>
        ) : (
          coupons.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-graphite px-4 py-3 text-sm"
            >
              <span className="font-mono font-medium text-bronze-light">{c.code}</span>
              <span className="text-white/60">{c.kind === 'PERCENT' ? `${c.value}% off` : `${formatEuro(c.value)} off`}</span>
              <span className="text-white/40">· {locationName(c.locationId)}</span>
              {c.customerName ? (
                <span className="rounded bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">{c.customerName} only</span>
              ) : null}
              {c.isBirthdayReward ? (
                <span className="rounded bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">Birthday</span>
              ) : null}
              {c.lowPeakOnly ? <span className="text-xs text-white/40">Low-peak only</span> : null}
              <span className="text-xs text-white/40">
                {c.redemptions}
                {c.maxRedemptions !== null ? `/${c.maxRedemptions}` : ''} used
              </span>
              {c.validFrom || c.validUntil ? (
                <span className="text-xs text-white/40">
                  {c.validFrom ? c.validFrom.slice(0, 10) : '…'} → {c.validUntil ? c.validUntil.slice(0, 10) : '…'}
                </span>
              ) : null}
              <span
                className={`ml-auto rounded px-2 py-0.5 text-xs ${
                  c.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/40'
                }`}
              >
                {c.isActive ? 'Active' : 'Inactive'}
              </span>
              <form action={toggleCoupon}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="isActive" value={String(c.isActive)} />
                <button
                  type="submit"
                  className="rounded-md border border-white/15 px-3 py-1 text-xs text-white/60 transition hover:text-white"
                >
                  {c.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-graphite p-6">
        <h2 className="text-2xl">New coupon</h2>
        <form action={createCoupon} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Code
            <input
              name="code"
              type="text"
              required
              placeholder="SUMMER10"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 uppercase text-white outline-none focus:border-bronze"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Type
            <select
              name="kind"
              required
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            >
              <option value="PERCENT">Percent off</option>
              <option value="AMOUNT">Fixed amount off</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Value
            <input
              name="value"
              type="number"
              min={1}
              required
              placeholder="10 (% or cents)"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Branch
            <select
              name="locationId"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            >
              <option value="">All branches</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Customer email
            <input
              name="customerEmail"
              type="email"
              placeholder="Leave blank for anyone"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Max redemptions
            <input
              name="maxRedemptions"
              type="number"
              min={1}
              placeholder="Unlimited"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Valid from
            <input
              name="validFrom"
              type="date"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Valid until
            <input
              name="validUntil"
              type="date"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input name="lowPeakOnly" type="checkbox" className="rounded border-white/10" />
            Low-peak only
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60 sm:col-span-2 lg:col-span-3">
            Notes
            <input
              name="notes"
              type="text"
              placeholder="Optional"
              className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default CouponsPage;
