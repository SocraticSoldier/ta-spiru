import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { JSX } from 'react';
import type { AuthUser, KioskStaffMember, LocationSummary } from '@ta-spiru/shared';
import { KioskClient } from '@/components/kiosk/kiosk-client';
import { apiFetch } from '@/lib/api';
import { locationColor } from '@/lib/colors';

export const metadata: Metadata = {
  title: "Ta' Spiru — Staff Clock-in",
  robots: { index: false, follow: false },
};

const BranchPicker = ({ locations }: { locations: LocationSummary[] }): JSX.Element => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6">
    <p className="font-display text-4xl text-bronze-light">Ta&rsquo; Spiru</p>
    <p className="font-script mt-1 text-xl text-bronze">Staff clock-in</p>
    <p className="mt-8 text-white/60">Choose this device&rsquo;s branch</p>
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      {locations.map((location) => (
        <Link
          key={location.id}
          href={`/kiosk?locationId=${location.id}`}
          className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-graphite px-5 py-3 transition hover:border-white/30"
        >
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: locationColor(location.slug) }} />
          {location.name}
        </Link>
      ))}
    </div>
  </main>
);

const KioskPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}): Promise<JSX.Element> => {
  const params = await searchParams;

  let user: AuthUser | null = null;
  try {
    user = await apiFetch<AuthUser>('/auth/me');
  } catch {
    user = null;
  }
  if (!user) {
    redirect('/admin/login');
  }
  if (user.role === 'CUSTOMER') {
    redirect('/account');
  }

  // Location-scoped staff use their own branch; admins pick one.
  const locationId = user.locationId ?? params.locationId ?? null;
  if (!locationId) {
    const locations = await apiFetch<LocationSummary[]>('/locations').catch((): LocationSummary[] => []);
    return <BranchPicker locations={locations} />;
  }

  const [locations, staff] = await Promise.all([
    apiFetch<LocationSummary[]>('/locations').catch((): LocationSummary[] => []),
    apiFetch<KioskStaffMember[]>(`/timeclock/staff?locationId=${locationId}`).catch(
      (): KioskStaffMember[] => [],
    ),
  ]);
  const locationName = locations.find((location) => location.id === locationId)?.name ?? 'Branch';

  return <KioskClient locationId={locationId} locationName={locationName} staff={staff} />;
};

export default KioskPage;
