import Link from 'next/link';
import type { JSX } from 'react';
import type {
  AppointmentRow,
  AuthUser,
  AvailabilitySlot,
  LocationSummary,
  ServiceSummary,
  StaffOption,
  TimeBlockRow,
} from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { KIND_COLORS, locationColor } from '@/lib/colors';
import { formatEuro } from '@/lib/format';
import { formatTimeMalta, maltaHour, shiftDate, todayMalta } from '@/lib/time';
import { createManualBooking, createTimeBlock, deleteTimeBlock, rescheduleBooking } from './actions';

interface CustomerSearchRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

/** HH:mm in Malta wall-clock time, for prefilling the reschedule time input. */
const maltaHHmm = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Malta', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );

const RESCHEDULABLE_STATUSES = new Set(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']);

interface CalendarSearchParams {
  locationId?: string;
  date?: string;
  q?: string;
  customerId?: string;
  serviceId?: string;
}

type CalendarEntry = AppointmentRow & { locationSlug: string; locationName: string };
type CalendarBlock = TimeBlockRow & { locationSlug: string; locationName: string };

const DAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const STATUS_DOTS: Record<string, string> = {
  PENDING_PAYMENT: '#f59e0b',
  CONFIRMED: '#4ade80',
  CHECKED_IN: '#38bdf8',
  IN_PROGRESS: '#cfae7b',
  COMPLETED: 'rgba(255,255,255,0.35)',
  CANCELLED: '#f87171',
  NO_SHOW: '#f87171',
};

const CalendarPage = async ({
  searchParams,
}: {
  searchParams: Promise<CalendarSearchParams>;
}): Promise<JSX.Element> => {
  const params = await searchParams;
  const date = params.date ?? todayMalta();
  const selectedId = params.locationId ?? 'all';

  let user: AuthUser | null = null;
  let locations: LocationSummary[] = [];
  try {
    [user, locations] = await Promise.all([
      apiFetch<AuthUser>('/auth/me'),
      apiFetch<LocationSummary[]>('/locations'),
    ]);
  } catch {
    locations = [];
  }
  const canManageBlocks = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canBook = canManageBlocks || user?.role === 'RECEPTIONIST';
  const selectedLocation = selectedId !== 'all' ? locations.find((location) => location.id === selectedId) : undefined;
  const visible =
    selectedId === 'all' ? locations : locations.filter((location) => location.id === selectedId);

  const entries: CalendarEntry[] = [];
  const blocks: CalendarBlock[] = [];
  const barbers: (StaffOption & { locationName: string })[] = [];
  await Promise.all(
    visible.map(async (location) => {
      const [dayRows, blockRows, barberRows] = await Promise.all([
        apiFetch<AppointmentRow[]>(
          `/bookings/day?locationId=${location.id}&date=${date}`,
        ).catch((): AppointmentRow[] => []),
        apiFetch<TimeBlockRow[]>(`/time-blocks?locationId=${location.id}&date=${date}`).catch(
          (): TimeBlockRow[] => [],
        ),
        apiFetch<StaffOption[]>(`/locations/${location.id}/barbers`).catch((): StaffOption[] => []),
      ]);
      entries.push(
        ...dayRows.map((row) => ({ ...row, locationSlug: location.slug, locationName: location.name })),
      );
      blocks.push(
        ...blockRows.map((row) => ({ ...row, locationSlug: location.slug, locationName: location.name })),
      );
      barbers.push(...barberRows.map((row) => ({ ...row, locationName: location.name })));
    }),
  );
  entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  blocks.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const query = (nextDate: string, nextLocation: string): string =>
    `/admin/calendar?locationId=${nextLocation}&date=${nextDate}`;

  // New-booking wizard: search customer → pick service → pick a real slot.
  let barberServices: ServiceSummary[] = [];
  let customerResults: CustomerSearchRow[] = [];
  let slots: AvailabilitySlot[] = [];
  if (canBook && selectedLocation) {
    barberServices = await apiFetch<ServiceSummary[]>('/services?kind=BARBER').catch((): ServiceSummary[] => []);
    if (params.q) {
      customerResults = await apiFetch<CustomerSearchRow[]>(`/customers?q=${encodeURIComponent(params.q)}`).catch(
        (): CustomerSearchRow[] => [],
      );
    }
    if (params.customerId && params.serviceId) {
      slots = await apiFetch<AvailabilitySlot[]>(
        `/bookings/availability?locationId=${selectedLocation.id}&date=${date}&serviceId=${params.serviceId}`,
      ).catch((): AvailabilitySlot[] => []);
    }
  }
  const selectedCustomer = customerResults.find((c) => c.id === params.customerId);
  const selectedService = barberServices.find((s) => s.id === params.serviceId);
  const bookingQuery = (overrides: Partial<CalendarSearchParams>): string => {
    const merged: CalendarSearchParams = { locationId: selectedId, date, ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.locationId) qs.set('locationId', merged.locationId);
    if (merged.date) qs.set('date', merged.date);
    if (merged.q) qs.set('q', merged.q);
    if (merged.customerId) qs.set('customerId', merged.customerId);
    if (merged.serviceId) qs.set('serviceId', merged.serviceId);
    return `/admin/calendar?${qs.toString()}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">Calendar</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={query(shiftDate(date, -1), selectedId)} className="rounded-lg border border-white/10 px-3 py-1.5 text-white/60 transition hover:border-bronze hover:text-bronze-light">←</Link>
          <Link href={query(todayMalta(), selectedId)} className="rounded-lg border border-white/10 px-3 py-1.5 text-white/60 transition hover:border-bronze hover:text-bronze-light">Today</Link>
          <Link href={query(shiftDate(date, 1), selectedId)} className="rounded-lg border border-white/10 px-3 py-1.5 text-white/60 transition hover:border-bronze hover:text-bronze-light">→</Link>
          <span className="ml-2 tabular-nums text-white/60">{date}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={query(date, 'all')}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${
            selectedId === 'all'
              ? 'bg-white/15 text-white'
              : 'border border-white/10 text-white/60 hover:text-white'
          }`}
        >
          All branches
        </Link>
        {locations.map((location) => (
          <Link
            key={location.id}
            href={query(date, location.id)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${
              selectedId === location.id
                ? 'bg-white/15 text-white'
                : 'border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: locationColor(location.slug) }} />
            {location.name}
          </Link>
        ))}
        <span className="mx-2 hidden h-4 w-px bg-white/10 sm:block" />
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2 w-4 rounded-sm" style={{ backgroundColor: KIND_COLORS.BARBER.solid }} />
          <span className="font-script text-lg text-bronze-light">The Barber</span>
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2 w-4 rounded-sm" style={{ backgroundColor: KIND_COLORS.WASH.solid }} />
          <span className="font-script text-lg text-wash-light">The Car Wash</span>
        </span>
      </div>

      <div className="mt-6 flex flex-col">
        {DAY_HOURS.map((hour) => {
          const hourEntries = entries.filter((entry) => maltaHour(entry.startsAt) === hour);
          const hourBlocks = blocks.filter((block) => maltaHour(block.startsAt) === hour);
          return (
            <div key={hour} className="flex gap-4 border-t border-white/5 py-2.5">
              <p className="font-display w-12 shrink-0 pt-1 text-right text-sm text-white/35">
                {String(hour).padStart(2, '0')}:00
              </p>
              <div className="flex min-h-[30px] flex-1 flex-wrap items-start gap-2">
                {hourBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-2.5 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-sm text-red-200/90"
                  >
                    <span className="tabular-nums text-red-200/60">
                      {formatTimeMalta(block.startsAt)}–{formatTimeMalta(block.endsAt)}
                    </span>
                    Blocked · {block.barberName ?? `all of ${block.locationName}`}
                    {block.reason ? <span className="text-red-200/60">({block.reason})</span> : null}
                    {canManageBlocks ? (
                      <form action={deleteTimeBlock}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <button type="submit" className="text-red-200/60 transition hover:text-red-100" aria-label="Remove block">
                          ✕
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {hourEntries.map((entry) => {
                  const accent = KIND_COLORS[entry.serviceKind];
                  const canReschedule =
                    canManageBlocks &&
                    entry.serviceKind === 'BARBER' &&
                    !entry.comboGroupId &&
                    RESCHEDULABLE_STATUSES.has(entry.status);
                  const row = (
                    <div
                      className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm"
                      style={{
                        background: accent.soft,
                        boxShadow: `inset 3px 0 0 ${accent.solid}`,
                      }}
                    >
                      <span
                        aria-hidden
                        title={entry.locationName}
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: locationColor(entry.locationSlug) }}
                      />
                      <span className="tabular-nums text-white/60">
                        {formatTimeMalta(entry.startsAt)}
                      </span>
                      <span className="font-medium">{entry.customerName}</span>
                      <span className="text-white/60">{entry.serviceName}</span>
                      {entry.barberName ?? entry.resourceName ? (
                        <span className="text-white/40">· {entry.barberName ?? entry.resourceName}</span>
                      ) : null}
                      {entry.comboGroupId ? (
                        <span className="rounded bg-bronze/20 px-1.5 py-0.5 text-xs text-bronze-light">Combo</span>
                      ) : null}
                      <span
                        aria-hidden
                        title={entry.status}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: STATUS_DOTS[entry.status] ?? '#9ca3af' }}
                      />
                    </div>
                  );
                  if (!canReschedule) {
                    return <div key={entry.id}>{row}</div>;
                  }
                  return (
                    <details key={entry.id} className="group">
                      <summary className="cursor-pointer list-none">{row}</summary>
                      <form
                        action={rescheduleBooking}
                        className="mt-1.5 flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-graphite-deep/60 p-3 text-xs"
                      >
                        <input type="hidden" name="appointmentId" value={entry.id} />
                        <label className="flex flex-col gap-1 text-white/50">
                          Date
                          <input
                            name="date"
                            type="date"
                            defaultValue={date}
                            required
                            className="rounded-md border border-white/10 bg-graphite px-2 py-1 text-white outline-none focus:border-bronze"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-white/50">
                          Time
                          <input
                            name="time"
                            type="time"
                            defaultValue={maltaHHmm(entry.startsAt)}
                            required
                            className="rounded-md border border-white/10 bg-graphite px-2 py-1 text-white outline-none focus:border-bronze"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded-md bg-bronze px-3 py-1.5 font-medium text-graphite-deep transition hover:bg-bronze-light"
                        >
                          Move
                        </button>
                      </form>
                    </details>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {canBook && selectedLocation ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-graphite p-6">
          <h2 className="text-2xl">New booking</h2>
          <p className="mt-1 text-sm text-white/50">
            Phone or desk booking for {selectedLocation.name} on {date}.
          </p>

          {!selectedCustomer ? (
            <form method="GET" className="mt-5 flex flex-wrap items-end gap-3">
              <input type="hidden" name="locationId" value={selectedId} />
              <input type="hidden" name="date" value={date} />
              <label className="flex flex-col gap-1.5 text-sm text-white/60">
                Find customer
                <input
                  name="q"
                  type="text"
                  defaultValue={params.q ?? ''}
                  placeholder="Name, phone or email"
                  className="w-64 rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
                />
              </label>
              <button type="submit" className="rounded-lg border border-white/15 px-4 py-2 text-white/70 transition hover:text-white">
                Search
              </button>
            </form>
          ) : (
            <div className="mt-5 flex items-center gap-3 text-sm">
              <span className="text-white/50">Booking for</span>
              <span className="font-medium">{selectedCustomer.name}</span>
              <span className="text-white/40">{selectedCustomer.email}</span>
              <Link href={bookingQuery({ q: undefined, customerId: undefined, serviceId: undefined })} className="text-bronze-light hover:underline">
                Change
              </Link>
            </div>
          )}

          {!selectedCustomer && params.q ? (
            <div className="mt-3 flex flex-col gap-1.5">
              {customerResults.length === 0 ? (
                <p className="text-sm text-white/40">No customers matched &ldquo;{params.q}&rdquo;.</p>
              ) : (
                customerResults.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    href={bookingQuery({ customerId: c.id })}
                    className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:border-bronze hover:text-bronze-light"
                  >
                    <span>{c.name}</span>
                    <span className="text-white/40">{c.email}{c.phone ? ` · ${c.phone}` : ''}</span>
                  </Link>
                ))
              )}
            </div>
          ) : null}

          {selectedCustomer && !selectedService ? (
            <form method="GET" className="mt-5 flex flex-wrap items-end gap-3">
              <input type="hidden" name="locationId" value={selectedId} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="q" value={params.q ?? ''} />
              <input type="hidden" name="customerId" value={selectedCustomer.id} />
              <label className="flex flex-col gap-1.5 text-sm text-white/60">
                Service
                <select name="serviceId" required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze">
                  {barberServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {formatEuro(s.priceCents)}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded-lg border border-white/15 px-4 py-2 text-white/70 transition hover:text-white">
                Continue
              </button>
            </form>
          ) : null}

          {selectedCustomer && selectedService ? (
            <div className="mt-5">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white/50">Service</span>
                <span className="font-medium">{selectedService.name}</span>
                <Link href={bookingQuery({ serviceId: undefined })} className="text-bronze-light hover:underline">
                  Change service
                </Link>
              </div>
              {slots.length === 0 ? (
                <p className="mt-3 text-sm text-white/40">
                  No availability for {selectedService.name} on {date} — try another day.
                </p>
              ) : (
                <form action={createManualBooking} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="customerId" value={selectedCustomer.id} />
                  <input type="hidden" name="locationId" value={selectedId} />
                  <input type="hidden" name="serviceId" value={selectedService.id} />
                  <label className="flex flex-col gap-1.5 text-sm text-white/60">
                    Time — next available first
                    <select name="slot" required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze">
                      {slots.map((slot) => (
                        <option key={`${slot.startsAt}|${slot.barberId}`} value={`${slot.startsAt}|${slot.barberId}`}>
                          {formatTimeMalta(slot.startsAt)} — {slot.barberName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm text-white/60">
                    Notes
                    <input name="notes" type="text" placeholder="Optional" className="w-56 rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
                  </label>
                  <button type="submit" className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light">
                    Book appointment
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {canManageBlocks ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-graphite p-6">
          <h2 className="text-2xl">Block out time</h2>
          <p className="mt-1 text-sm text-white/50">
            Breaks, closures and holidays — blocked windows disappear from client booking immediately.
          </p>
          <form action={createTimeBlock} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Branch
              <select name="locationId" required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze">
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Who
              <select name="barberId" className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze">
                <option value="">Entire branch (chairs + bays)</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name} — {barber.locationName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Date
              <input name="date" type="date" defaultValue={date} required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              From
              <input name="from" type="time" defaultValue="12:00" required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Until
              <input name="to" type="time" defaultValue="13:00" required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Reason
              <input name="reason" type="text" placeholder="Lunch break, training…" className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <button type="submit" className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light">
                Block it out
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
};

export default CalendarPage;
