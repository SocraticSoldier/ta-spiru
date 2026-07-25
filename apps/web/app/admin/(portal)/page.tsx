import type { JSX } from 'react';
import type { AuthUser, LocationSummary } from '@ta-spiru/shared';
import { VaultPanel } from '@/components/admin/vault-panel';
import { apiFetch } from '@/lib/api';
import { locationColor } from '@/lib/colors';

interface DashboardData {
  user: AuthUser | null;
  locations: LocationSummary[];
}

const getDashboardData = async (): Promise<DashboardData> => {
  try {
    const [user, locations] = await Promise.all([
      apiFetch<AuthUser>('/auth/me'),
      apiFetch<LocationSummary[]>('/locations'),
    ]);
    return { user, locations };
  } catch {
    return { user: null, locations: [] };
  }
};

const DashboardPage = async (): Promise<JSX.Element> => {
  const { user, locations } = await getDashboardData();

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <h1 className="text-4xl">Dashboard</h1>
        <p className="font-script text-2xl text-bronze/80">
          It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
        </p>
      </div>

      <h2 className="mt-8 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
        Sales — owner only
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {user?.role === 'ADMIN' ? (
          <VaultPanel />
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50 sm:col-span-2 lg:col-span-4">
            Revenue is visible to owner/admin accounts only.
          </div>
        )}
      </div>

      <h2 className="mt-10 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
        Branch network
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {locations.map((location) => (
          <div
            key={location.id}
            className="rounded-2xl border border-white/10 bg-graphite p-5"
            style={{ boxShadow: `inset 3px 0 0 ${locationColor(location.slug)}` }}
          >
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
