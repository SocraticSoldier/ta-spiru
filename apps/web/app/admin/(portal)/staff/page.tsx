import type { JSX } from 'react';
import type { TimeEntryRow } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';

const getEntries = async (): Promise<TimeEntryRow[] | null> => {
  try {
    return await apiFetch<TimeEntryRow[]>('/timeclock/entries');
  } catch {
    return null;
  }
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-MT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Malta' });

const StaffPage = async (): Promise<JSX.Element> => {
  const entries = await getEntries();

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-4xl">Staff</h1>
        <p className="text-sm text-white/50">Timeclock · today</p>
      </div>

      {entries === null ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          Time entries unavailable — check that the API is running.
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          No punches recorded today. Staff clock in with their PIN on the in-store kiosk.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-graphite text-white/60">
              <tr>
                <th className="px-4 py-2.5 font-medium">Staff</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Branch</th>
                <th className="px-4 py-2.5 font-medium">Clock in</th>
                <th className="px-4 py-2.5 font-medium">Clock out</th>
                <th className="px-4 py-2.5 text-right font-medium">Worked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2.5">{entry.staffName}</td>
                  <td className="px-4 py-2.5 text-white/60">{entry.role}</td>
                  <td className="px-4 py-2.5 text-white/60">{entry.locationName}</td>
                  <td className="px-4 py-2.5">{formatTime(entry.clockInAt)}</td>
                  <td className="px-4 py-2.5">
                    {entry.clockOutAt ? (
                      formatTime(entry.clockOutAt)
                    ) : (
                      <span className="rounded bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">
                        On shift
                      </span>
                    )}
                  </td>
                  <td className="font-display px-4 py-2.5 text-right text-base">
                    {entry.workedMinutes !== null ? `${Math.floor(entry.workedMinutes / 60)}h ${entry.workedMinutes % 60}m` : '—'}
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

export default StaffPage;
