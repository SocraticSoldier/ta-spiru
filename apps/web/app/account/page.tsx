import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { JSX } from 'react';
import QRCode from 'qrcode';
import type { AuthUser, LoyaltyPass, LoyaltySummary, MyBookingRow, OrderRow } from '@ta-spiru/shared';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { apiFetch } from '@/lib/api';
import { KIND_COLORS } from '@/lib/colors';
import { formatEuro } from '@/lib/format';
import { formatTimeMalta } from '@/lib/time';
import { cancelBooking } from './actions';

const TIER_LABELS: Record<string, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
};

const BookingCard = ({
  booking,
  cancellable,
}: {
  booking: MyBookingRow;
  cancellable: boolean;
}): JSX.Element => {
  const accent = KIND_COLORS[booking.serviceKind];
  return (
    <li
      className="flex flex-wrap items-center gap-4 rounded-xl px-4 py-3"
      style={{ background: accent.soft, boxShadow: `inset 3px 0 0 ${accent.solid}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {booking.serviceName}
          {booking.comboGroupId ? (
            <span className="ml-2 rounded bg-bronze/20 px-1.5 py-0.5 text-xs text-bronze-light">Combo</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-sm text-white/55">
          {booking.startsAt.slice(0, 10)} · {formatTimeMalta(booking.startsAt)} · {booking.locationName}
          {booking.barberName ? ` · ${booking.barberName}` : ''}
          {booking.vehicleReg ? ` · ${booking.vehicleReg}` : ''}
        </p>
      </div>
      <span className="font-display text-lg" style={{ color: accent.text }}>
        {formatEuro(booking.priceCents)}
      </span>
      <span className="text-xs uppercase tracking-widest text-white/45">
        {booking.status.replaceAll('_', ' ')}
      </span>
      {cancellable ? (
        <form action={cancelBooking}>
          <input type="hidden" name="appointmentId" value={booking.id} />
          <button
            type="submit"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 transition hover:border-red-400/60 hover:text-red-300"
          >
            Cancel
          </button>
        </form>
      ) : null}
    </li>
  );
};

const AccountPage = async (): Promise<JSX.Element> => {
  let user: AuthUser | null = null;
  try {
    user = await apiFetch<AuthUser>('/auth/me');
  } catch {
    user = null;
  }
  if (!user) {
    redirect('/signin');
  }

  const [bookings, loyalty, pass, orders] = await Promise.all([
    apiFetch<MyBookingRow[]>('/bookings/mine').catch((): MyBookingRow[] => []),
    apiFetch<LoyaltySummary>('/loyalty/me').catch((): LoyaltySummary | null => null),
    apiFetch<LoyaltyPass>('/loyalty/pass').catch((): LoyaltyPass | null => null),
    apiFetch<OrderRow[]>('/orders/mine').catch((): OrderRow[] => []),
  ]);

  const qrDataUrl = pass
    ? await QRCode.toDataURL(pass.qrPayload, {
        margin: 1,
        width: 220,
        color: { dark: '#0e0e10', light: '#cfae7b' },
      })
    : null;

  const now = Date.now();
  const upcoming = bookings.filter(
    (booking) =>
      new Date(booking.startsAt).getTime() > now &&
      booking.status !== 'CANCELLED' &&
      booking.status !== 'NO_SHOW',
  );
  const past = bookings.filter((booking) => !upcoming.includes(booking)).slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="font-display text-3xl text-bronze-light">
            Ta&rsquo; Spiru
          </Link>
          <p className="font-script mt-1 text-xl text-bronze">
            It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
          </p>
        </div>
        <SignOutButton redirectTo="/" />
      </div>

      <h1 className="mt-8 text-5xl">
        Hi, {user.firstName}
      </h1>

      {loyalty && pass && qrDataUrl ? (
        <section className="mt-8 flex flex-wrap items-center gap-6 rounded-2xl border border-bronze/30 bg-gradient-to-br from-bronze/15 to-graphite p-6">
          <img src={qrDataUrl} alt="Loyalty wallet pass QR code" className="h-36 w-36 rounded-lg" />
          <div>
            <p className="font-script text-2xl text-bronze-light">
              {TIER_LABELS[loyalty.tier] ?? loyalty.tier} member
            </p>
            <p className="font-display mt-1 text-5xl text-bronze-light">{loyalty.balancePoints}</p>
            <p className="text-sm text-white/55">points to spend · {loyalty.lifetimePoints} lifetime</p>
            <p className="mt-2 max-w-xs text-xs text-white/40">
              Show this code at reception to earn and redeem across the barbershop and the car wash.
            </p>
          </div>
        </section>
      ) : null}

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-3xl">Upcoming</h2>
        <Link href="/book" className="rounded-lg bg-bronze px-4 py-2 text-sm font-medium text-graphite-deep transition hover:bg-bronze-light">
          Book again
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/50">
          Nothing booked yet —{' '}
          <Link href="/book" className="text-bronze-light hover:underline">
            grab a slot
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {upcoming.map((booking) => (
            <BookingCard key={booking.id} booking={booking} cancellable />
          ))}
        </ul>
      )}

      {past.length > 0 ? (
        <>
          <h2 className="mt-10 text-3xl">History</h2>
          <ul className="mt-4 flex flex-col gap-2.5 opacity-70">
            {past.map((booking) => (
              <BookingCard key={booking.id} booking={booking} cancellable={false} />
            ))}
          </ul>
        </>
      ) : null}

      {orders.length > 0 ? (
        <>
          <h2 className="mt-10 text-3xl">Orders</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-white/10 bg-graphite px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-white/70">
                    {order.createdAt.slice(0, 10)} · {order.locationName} ·{' '}
                    {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}
                  </p>
                  <span className="font-display text-lg text-bronze-light">
                    {formatEuro(order.totalCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
};

export default AccountPage;
