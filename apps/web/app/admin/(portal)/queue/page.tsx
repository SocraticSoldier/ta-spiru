import Link from 'next/link';
import type { JSX } from 'react';
import type {
  AuthUser,
  LocationSummary,
  QueueEntryView,
  QueueSnapshot,
  ServiceSummary,
} from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { KIND_COLORS, locationColor } from '@/lib/colors';
import { formatTimeMalta } from '@/lib/time';
import { addWalkIn, transitionEntry } from './actions';

interface QueueSearchParams {
  locationId?: string;
}

const ActionButton = ({
  entryId,
  action,
  label,
  primary = false,
}: {
  entryId: string;
  action: string;
  label: string;
  primary?: boolean;
}): JSX.Element => (
  <form action={transitionEntry}>
    <input type="hidden" name="entryId" value={entryId} />
    <input type="hidden" name="action" value={action} />
    <button
      type="submit"
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
        primary
          ? 'bg-bronze text-graphite-deep hover:bg-bronze-light'
          : 'border border-white/15 text-white/60 hover:border-white/40 hover:text-white'
      }`}
    >
      {label}
    </button>
  </form>
);

const EntryActions = ({ entry }: { entry: QueueEntryView }): JSX.Element | null => {
  if (entry.status === 'WAITING') {
    return (
      <div className="flex gap-2">
        <ActionButton entryId={entry.id} action="call" label="Call" primary />
        <ActionButton entryId={entry.id} action="leave" label="Left" />
      </div>
    );
  }
  if (entry.status === 'CALLED') {
    return (
      <div className="flex gap-2">
        <ActionButton entryId={entry.id} action="start" label="Start" primary />
        <ActionButton entryId={entry.id} action="leave" label="Left" />
      </div>
    );
  }
  if (entry.status === 'IN_SERVICE') {
    return <ActionButton entryId={entry.id} action="complete" label="Done" primary />;
  }
  return null;
};

const QueuePage = async ({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}): Promise<JSX.Element> => {
  const params = await searchParams;

  let user: AuthUser | null = null;
  let locations: LocationSummary[] = [];
  let services: ServiceSummary[] = [];
  try {
    [user, locations, services] = await Promise.all([
      apiFetch<AuthUser>('/auth/me'),
      apiFetch<LocationSummary[]>('/locations'),
      apiFetch<ServiceSummary[]>('/services'),
    ]);
  } catch {
    locations = [];
  }

  const selected =
    locations.find((location) => location.id === params.locationId) ??
    locations.find((location) => location.id === user?.locationId) ??
    locations[0];

  let snapshot: QueueSnapshot | null = null;
  if (selected) {
    try {
      snapshot = await apiFetch<QueueSnapshot>(`/queue?locationId=${selected.id}`);
    } catch {
      snapshot = null;
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">Queue</h1>
        {snapshot ? (
          <p className="text-sm tabular-nums text-white/50">
            Updated {formatTimeMalta(snapshot.generatedAt)} ·{' '}
            <Link href={`/display/${selected?.slug ?? ''}`} className="text-bronze-light hover:underline">
              Open TV board →
            </Link>
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {locations.map((location) => (
          <Link
            key={location.id}
            href={`/admin/queue?locationId=${location.id}`}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${
              selected?.id === location.id
                ? 'bg-white/15 text-white'
                : 'border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: locationColor(location.slug) }} />
            {location.name}
          </Link>
        ))}
      </div>

      {snapshot === null ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          Queue unavailable — check that the API is running.
        </div>
      ) : snapshot.entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          Queue is empty — add a walk-in below.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2.5">
          {snapshot.entries.map((entry) => {
            const accent = KIND_COLORS[entry.serviceKind];
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-4 rounded-xl px-4 py-3"
                style={{ background: accent.soft, boxShadow: `inset 3px 0 0 ${accent.solid}` }}
              >
                <span
                  className="font-display flex h-9 w-9 items-center justify-center rounded-full text-base"
                  style={{ backgroundColor: accent.solid, color: '#0e0e10' }}
                >
                  {entry.status === 'CALLED' ? '→' : entry.status === 'IN_SERVICE' ? '●' : entry.position ?? '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {entry.displayName}
                    {entry.vehicleReg ? <span className="ml-2 text-sm text-white/50">{entry.vehicleReg}</span> : null}
                  </p>
                  <p className="text-sm text-white/55">
                    {entry.serviceName} · joined {formatTimeMalta(entry.joinedAt)}
                    {entry.estimatedWaitMin !== null ? ` · ~${entry.estimatedWaitMin} min` : ''}
                  </p>
                </div>
                <span className="font-script text-lg" style={{ color: accent.text }}>
                  {entry.serviceKind === 'BARBER' ? 'The Barber' : 'The Car Wash'}
                </span>
                <span className="text-xs uppercase tracking-widest text-white/50">
                  {entry.status.replaceAll('_', ' ')}
                </span>
                <EntryActions entry={entry} />
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-graphite p-6">
          <h2 className="text-2xl">Add walk-in</h2>
          <form action={addWalkIn} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="locationId" value={selected.id} />
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Name
              <input name="displayName" type="text" required placeholder="First name + initial" className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Service
              <select name="serviceId" required className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze">
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.kind === 'BARBER' ? 'Barber' : 'Wash'})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Vehicle (wash only)
              <input name="vehicleReg" type="text" placeholder="ABC 123" className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze" />
            </label>
            <div className="flex items-end">
              <button type="submit" className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light">
                Add to queue
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
};

export default QueuePage;
