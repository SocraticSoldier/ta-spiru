import Link from 'next/link';
import type { JSX } from 'react';
import type { AppointmentRow, LocationSummary } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';

interface CalendarSearchParams {
  locationId?: string;
  date?: string;
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-MT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Malta' });

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-500/15 text-amber-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  CHECKED_IN: 'bg-sky-500/15 text-sky-400',
  IN_PROGRESS: 'bg-bronze/15 text-bronze-light',
  COMPLETED: 'bg-white/10 text-white/60',
  CANCELLED: 'bg-red-500/15 text-red-400',
  NO_SHOW: 'bg-red-500/15 text-red-400',
};

const CalendarPage = async ({
  searchParams,
}: {
  searchParams: Promise<CalendarSearchParams>;
}): Promise<JSX.Element> => {
  const params = await searchParams;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  let locations: LocationSummary[] = [];
  try {
    locations = await apiFetch<LocationSummary[]>('/locations');
  } catch {
    locations = [];
  }
  const selected = locations.find((location) => location.id === params.locationId) ?? locations[0];

  let appointments: AppointmentRow[] | null = null;
  if (selected) {
    try {
      appointments = await apiFetch<AppointmentRow[]>(
        `/bookings/day?locationId=${encodeURIComponent(selected.id)}&date=${encodeURIComponent(date)}`,
      );
    } catch {
      appointments = null;
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-white/50">{date} · Europe/Malta</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {locations.map((location) => (
          <Link
            key={location.id}
            href={`/admin/calendar?locationId=${location.id}&date=${date}`}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              selected?.id === location.id
                ? 'bg-bronze/20 text-bronze-light'
                : 'border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {location.name}
          </Link>
        ))}
      </div>

      {appointments === null ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          Schedule unavailable — check that the API is running.
        </div>
      ) : appointments.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          No appointments booked for this day yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-graphite text-white/60">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Service</th>
                <th className="px-4 py-2.5 font-medium">Assigned to</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
                  </td>
                  <td className="px-4 py-2.5">{appointment.customerName}</td>
                  <td className="px-4 py-2.5">
                    {appointment.serviceName}
                    {appointment.comboGroupId ? (
                      <span className="ml-2 rounded bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">
                        Combo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-white/70">
                    {appointment.barberName ?? appointment.resourceName ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[appointment.status] ?? 'bg-white/10 text-white/60'}`}
                    >
                      {appointment.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default CalendarPage;
