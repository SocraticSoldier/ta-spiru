import type { JSX } from 'react';
import type { LocationSummary, RevenueSplitReport } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { formatEuro, LEDGER_TAG_LABELS } from '@/lib/format';

interface DashboardData {
  report: RevenueSplitReport | null;
  locations: LocationSummary[];
}

const getDashboardData = async (): Promise<DashboardData> => {
  try {
    const [report, locations] = await Promise.all([
      apiFetch<RevenueSplitReport>('/reports/revenue-splits'),
      apiFetch<LocationSummary[]>('/locations'),
    ]);
    return { report, locations };
  } catch {
    return { report: null, locations: [] };
  }
};

const DashboardPage = async (): Promise<JSX.Element> => {
  const { report, locations } = await getDashboardData();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <h2 className="mt-8 text-sm uppercase tracking-[0.2em] text-white/50">
        Settled revenue by ledger
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(report?.lines ?? []).map((line) => (
          <div key={line.ledgerTag} className="rounded-xl border border-white/10 bg-graphite p-5">
            <p className="text-sm text-white/60">{LEDGER_TAG_LABELS[line.ledgerTag] ?? line.ledgerTag}</p>
            <p className="mt-2 text-2xl font-semibold text-bronze-light">
              {formatEuro(line.amountCents)}
            </p>
            <p className="mt-1 text-xs text-white/40">{line.splitCount} ledger entries</p>
          </div>
        ))}
        {report === null ? (
          <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50 sm:col-span-2 lg:col-span-4">
            Revenue report unavailable — check that the API is running and your role is ADMIN.
          </div>
        ) : null}
      </div>

      <h2 className="mt-10 text-sm uppercase tracking-[0.2em] text-white/50">Branch network</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {locations.map((location) => (
          <div key={location.id} className="rounded-xl border border-white/10 bg-graphite p-5">
            <p className="font-medium">{location.name}</p>
            <p className="mt-1 text-sm text-white/60">{location.address}</p>
            <p className="mt-3 text-xs text-white/40">
              {location.chairCount} chairs · {location.bayCount} wash bays
            </p>
          </div>
        ))}
        {locations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50 sm:col-span-2">
            No branches loaded — run the database seed, then refresh.
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default DashboardPage;
