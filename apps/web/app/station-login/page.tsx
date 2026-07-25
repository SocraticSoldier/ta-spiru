import type { Metadata } from 'next';
import type { JSX } from 'react';
import type { LocationSummary } from '@ta-spiru/shared';
import { StationLoginClient } from '@/components/kiosk/station-login-client';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: "Ta' Spiru — Station Sign-in",
  robots: { index: false, follow: false },
};

const StationLoginPage = async (): Promise<JSX.Element> => {
  let locations: LocationSummary[] = [];
  try {
    const res = await fetch(`${API_URL}/api/v1/locations`, { cache: 'no-store' });
    if (res.ok) {
      const all = (await res.json()) as LocationSummary[];
      locations = all.filter((location) => location.isBarberOperated);
    }
  } catch {
    locations = [];
  }
  return <StationLoginClient locations={locations} />;
};

export default StationLoginPage;
