'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { BarberScheduleRow, PosCheckoutResponse, ServiceSummary, StockLevelRow, TipsSummary } from '@ta-spiru/shared';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { formatEuro } from '@/lib/format';
import { formatTimeMalta } from '@/lib/time';

const QUICK_TIP_CENTS = [200, 500, 1000, 2000];

const OPEN_STATUSES = new Set(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'LATE']);

/** Whole minutes from `nowMs` to `iso`; negative once `iso` is in the past. */
const minutesUntil = (nowMs: number, iso: string): number => Math.round((new Date(iso).getTime() - nowMs) / 60000);

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'IN_PROGRESS', label: 'Being served' },
  { value: 'LATE', label: 'Late' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'NO_SHOW', label: 'No show' },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-500/15 text-amber-300',
  CONFIRMED: 'bg-white/10 text-white/70',
  CHECKED_IN: 'bg-sky-500/15 text-sky-300',
  IN_PROGRESS: 'bg-bronze/20 text-bronze-light',
  COMPLETED: 'bg-emerald-500/15 text-emerald-300',
  NO_SHOW: 'bg-red-500/15 text-red-300',
  LATE: 'bg-amber-500/15 text-amber-300',
  CANCELLED: 'bg-red-500/15 text-red-300',
};

interface OverlapConfirm {
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  message: string;
}

export const MyDayClient = ({
  initialSchedule,
  services,
  initialTips,
  products,
  locationId,
  barberName,
}: {
  initialSchedule: BarberScheduleRow[];
  services: ServiceSummary[];
  initialTips: TipsSummary;
  products: StockLevelRow[];
  locationId: string | null;
  barberName: string;
}): JSX.Element => {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [tippingFor, setTippingFor] = useState<string | null>(null);
  const [overlap, setOverlap] = useState<OverlapConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState<TipsSummary>(initialTips);
  const [now, setNow] = useState(() => Date.now());
  const [tillOpen, setTillOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [posBusy, setPosBusy] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PosCheckoutResponse | null>(null);
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(poll);
  }, [router]);

  const sorted = [...initialSchedule].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const activeVisit = sorted.find((v) => v.status === 'IN_PROGRESS') ?? null;
  const upNext = sorted.find((v) => v.id !== activeVisit?.id && OPEN_STATUSES.has(v.status)) ?? null;

  const setStatus = async (appointmentId: string, status: string): Promise<void> => {
    setBusyId(appointmentId);
    setError(null);
    const res = await fetch('/api/barber/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'Could not update status');
      return;
    }
    router.refresh();
  };

  const addService = async (appointmentId: string, serviceId: string, acceptOverlap = false): Promise<void> => {
    setBusyId(appointmentId);
    setError(null);
    const res = await fetch('/api/barber/add-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, serviceId, acceptOverlap }),
    });
    setBusyId(null);
    if (res.status === 409) {
      const service = services.find((s) => s.id === serviceId);
      setOverlap({
        appointmentId,
        serviceId,
        serviceName: service?.name ?? 'this service',
        message: 'This will run into the next booking. Adding it is your call — keeping the next client on time becomes your responsibility.',
      });
      return;
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'Could not add the service');
      return;
    }
    setAddingFor(null);
    setOverlap(null);
    router.refresh();
  };

  const recordTip = async (amountCents: number, appointmentId?: string): Promise<void> => {
    const busyKey = appointmentId ?? 'general';
    setBusyId(busyKey);
    setError(null);
    const res = await fetch('/api/barber/tip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents, appointmentId }),
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'Could not record the tip');
      return;
    }
    const entry = (await res.json()) as { id: string; amountCents: number; appointmentId: string | null; createdAt: string };
    setTips((prev) => ({ totalCents: prev.totalCents + entry.amountCents, entries: [entry, ...prev.entries] }));
    setTippingFor(null);
  };

  const productsById = new Map(products.map((p) => [p.productId, p]));
  const cartLines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ product: productsById.get(productId), qty }))
    .filter((line): line is { product: StockLevelRow; qty: number } => Boolean(line.product));
  const cartTotalCents = cartLines.reduce((sum, line) => sum + line.product.priceCents * line.qty, 0);

  const addToCart = (product: StockLevelRow): void => {
    setCart((prev) => {
      const current = prev[product.productId] ?? 0;
      if (current >= product.quantity) return prev;
      return { ...prev, [product.productId]: current + 1 };
    });
  };

  const removeFromCart = (productId: string): void => {
    setCart((prev) => {
      const current = prev[productId] ?? 0;
      if (current <= 1) {
        const { [productId]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: current - 1 };
    });
  };

  const checkout = async (): Promise<void> => {
    if (!locationId || cartLines.length === 0) return;
    setPosBusy(true);
    setPosError(null);
    const res = await fetch('/api/barber/pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        items: cartLines.map((line) => ({ productId: line.product.productId, quantity: line.qty })),
        couponCode: couponCode.trim() || undefined,
      }),
    });
    setPosBusy(false);
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setPosError(payload?.message ?? 'Could not complete the sale');
      return;
    }
    const result = (await res.json()) as PosCheckoutResponse;
    setReceipt(result);
    setCart({});
    setCouponCode('');
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-3xl text-bronze-light">Ta&rsquo; Spiru</p>
          <h1 className="mt-1 text-2xl">{barberName}&rsquo;s day</h1>
        </div>
        <SignOutButton redirectTo="/admin/login" />
      </div>
      <p className="mt-2 text-sm text-white/50">
        Privacy: you see the client&rsquo;s name and requested services only — no phone, notes or prices from their profile.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-graphite p-4">
        <div>
          <p className="text-sm text-white/50">Tips today</p>
          <p className="mt-0.5 text-xl font-medium text-bronze-light">{formatEuro(tips.totalCents)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {QUICK_TIP_CENTS.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={busyId === 'general'}
              onClick={() => void recordTip(amount)}
              className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:border-bronze hover:text-bronze-light disabled:opacity-30"
            >
              +{formatEuro(amount)}
            </button>
          ))}
        </div>
      </div>

      {activeVisit || upNext ? (
        <div className="mt-4 rounded-xl border border-bronze/30 bg-bronze/10 p-4 text-sm">
          {activeVisit ? (
            <p>
              <span className="font-medium text-bronze-light">Serving {activeVisit.clientName}</span>
              {' — '}
              {(() => {
                const mins = minutesUntil(now, activeVisit.endsAt);
                return mins >= 0 ? `${mins}m left` : `${Math.abs(mins)}m over`;
              })()}
            </p>
          ) : null}
          {upNext ? (
            <p className={activeVisit ? 'mt-1 text-white/60' : 'font-medium text-bronze-light'}>
              Next: {upNext.clientName} at {formatTimeMalta(upNext.startsAt)}
              {' — '}
              {(() => {
                const mins = minutesUntil(now, upNext.startsAt);
                return mins <= 0 ? 'ready now' : `in ~${mins}m`;
              })()}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-white/10 bg-graphite p-4">
        <button
          type="button"
          onClick={() => setTillOpen((open) => !open)}
          className="flex w-full items-center justify-between text-sm"
        >
          <span className="font-medium">Sell products</span>
          <span className="text-white/50">{tillOpen ? 'Close till' : 'Open till'}</span>
        </button>

        {tillOpen ? (
          <div className="mt-3 border-t border-white/5 pt-3">
            {receipt ? (
              <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                <p>
                  Sale recorded — {formatEuro(receipt.totalCents)}
                  {receipt.discountCents > 0 ? ` (${formatEuro(receipt.discountCents)} off)` : ''}. Ref{' '}
                  {receipt.paymentIntent.paymentReference}.
                </p>
                <p className="mt-1 text-xs text-emerald-200/70">Hand the terminal to the client to complete payment.</p>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="mt-2 rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:text-white"
                >
                  New sale
                </button>
              </div>
            ) : (
              <>
                {products.length === 0 ? (
                  <p className="text-xs text-white/40">No stock on file for your branch.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {products.map((p) => (
                      <button
                        key={p.productId}
                        type="button"
                        disabled={posBusy || p.quantity <= (cart[p.productId] ?? 0)}
                        onClick={() => addToCart(p)}
                        className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-bronze/15 hover:text-bronze-light disabled:opacity-30"
                      >
                        {p.productName} · {formatEuro(p.priceCents)}
                      </button>
                    ))}
                  </div>
                )}

                {cartLines.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-white/5 pt-3">
                    {cartLines.map((line) => (
                      <div key={line.product.productId} className="flex items-center justify-between text-sm">
                        <span>
                          {line.qty} × {line.product.productName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-white/60">{formatEuro(line.product.priceCents * line.qty)}</span>
                          <button
                            type="button"
                            disabled={posBusy}
                            onClick={() => removeFromCart(line.product.productId)}
                            className="rounded-md border border-white/15 px-2 py-0.5 text-xs text-white/60 transition hover:text-white disabled:opacity-30"
                          >
                            −
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={posBusy}
                        placeholder="Voucher / gift card code"
                        className="w-full rounded-md border border-white/10 bg-graphite-deep px-2 py-1 text-xs uppercase text-white placeholder:normal-case placeholder:text-white/30 outline-none focus:border-bronze"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 text-sm font-medium">
                      <span>Total</span>
                      <span className="text-bronze-light">{formatEuro(cartTotalCents)}</span>
                    </div>
                    {posError ? <p className="text-xs text-red-300">{posError}</p> : null}
                    <button
                      type="button"
                      disabled={posBusy}
                      onClick={() => void checkout()}
                      className="mt-1 rounded-md bg-bronze px-3 py-1.5 text-sm font-medium text-graphite-deep transition hover:bg-bronze-light disabled:opacity-50"
                    >
                      Charge {formatEuro(cartTotalCents)}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      <div className="mt-6 flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
            Nothing on your chair today.
          </p>
        ) : null}
        {sorted.map((visit) => {
          const busy = busyId === visit.id || busyId === visit.lastAppointmentId;
          const availableToAdd = services.filter((s) => !visit.services.includes(s.name));
          return (
            <div key={visit.id} className="rounded-xl border border-white/10 bg-graphite p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="tabular-nums text-sm text-white/50">{formatTimeMalta(visit.startsAt)}</p>
                  <p className="mt-0.5 font-medium">{visit.clientName}</p>
                  <p className="mt-0.5 text-sm text-white/60">{visit.services.join(' + ')}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLE[visit.status] ?? 'bg-white/10 text-white/60'}`}>
                  {visit.status.replace('_', ' ').toLowerCase()}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busy || visit.status === opt.value}
                    onClick={() => void setStatus(visit.id, opt.value)}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:border-bronze hover:text-bronze-light disabled:opacity-30"
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAddingFor(addingFor === visit.id ? null : visit.id)}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:border-bronze hover:text-bronze-light disabled:opacity-30"
                >
                  + Add service
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTippingFor(tippingFor === visit.lastAppointmentId ? null : visit.lastAppointmentId)}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:border-bronze hover:text-bronze-light disabled:opacity-30"
                >
                  + Tip
                </button>
              </div>

              {tippingFor === visit.lastAppointmentId ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                  {QUICK_TIP_CENTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      disabled={busy}
                      onClick={() => void recordTip(amount, visit.lastAppointmentId)}
                      className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-bronze/15 hover:text-bronze-light disabled:opacity-30"
                    >
                      {formatEuro(amount)}
                    </button>
                  ))}
                </div>
              ) : null}

              {addingFor === visit.id ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                  {availableToAdd.length === 0 ? (
                    <p className="text-xs text-white/40">Every service is already on this visit.</p>
                  ) : (
                    availableToAdd.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={busy}
                        onClick={() => void addService(visit.lastAppointmentId, s.id)}
                        className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-bronze/15 hover:text-bronze-light disabled:opacity-30"
                      >
                        {s.name} · {formatEuro(s.priceCents)}
                      </button>
                    ))
                  )}
                </div>
              ) : null}

              {overlap && overlap.appointmentId === visit.lastAppointmentId ? (
                <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <p>{overlap.message}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOverlap(null)}
                      className="rounded-md border border-white/15 px-3 py-1.5 text-white/70 transition hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void addService(overlap.appointmentId, overlap.serviceId, true)}
                      className="rounded-md bg-bronze px-3 py-1.5 font-medium text-graphite-deep transition hover:bg-bronze-light"
                    >
                      Accept anyway
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
};
