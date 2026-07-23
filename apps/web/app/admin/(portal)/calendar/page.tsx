import Link from 'next/link';
import type { JSX } from 'react';
import type {
  AppointmentRow,
  AuthUser,
  LocationSummary,
  StaffOption,
  TimeBlockRow,
} from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { KIND_COLORS, locationColor } from '@/lib/colors';
import { formatTimeMalta, maltaHour, shiftDate, todayMalta } from '@/lib/time';
import { createTimeBlock, deleteTimeBlock } from './actions';

interface CalendarSearchParams {
  locationId?: string;
  date?: string;
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
        <span className="flex items-center gap-1.5 text-xs text-white/50">
          <span aria-hidden className="h-2 w-4 rounded-sm" style={{ backgroundColor: KIND_COLORS.BARBER.solid }} /> Barber
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/50">
          <span aria-hidden className="h-2 w-4 rounded-sm" style={{ backgroundColor: KIND_COLORS.WASH.solid }} /> Car wash
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
                  return (
                    <div
                      key={entry.id}
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
                })}
              </div>
            </div>
          );
        })}
      </div>

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
