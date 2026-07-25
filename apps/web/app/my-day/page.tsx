import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { JSX } from 'react';
import type { AuthUser, BarberScheduleRow, ServiceSummary, StockLevelRow, TipsSummary } from '@ta-spiru/shared';
import { MyDayClient } from '@/components/barber/my-day-client';
import { apiFetch } from '@/lib/api';
import { todayMalta } from '@/lib/time';

export const metadata: Metadata = {
  title: "Ta' Spiru — My Day",
  robots: { index: false, follow: false },
};

const MyDayPage = async (): Promise<JSX.Element> => {
  let user: AuthUser | null = null;
  try {
    user = await apiFetch<AuthUser>('/auth/me');
  } catch {
    user = null;
  }
  if (!user) {
    redirect('/admin/login?next=/my-day');
  }
  if (user.role !== 'BARBER') {
    redirect('/kiosk');
  }

  const date = todayMalta();
  const [schedule, services, tips, products] = await Promise.all([
    apiFetch<BarberScheduleRow[]>(`/barbers/me/schedule?date=${date}`).catch((): BarberScheduleRow[] => []),
    apiFetch<ServiceSummary[]>('/services?kind=BARBER').catch((): ServiceSummary[] => []),
    apiFetch<TipsSummary>('/team/me/tips').catch((): TipsSummary => ({ totalCents: 0, entries: [] })),
    user.locationId
      ? apiFetch<StockLevelRow[]>(`/inventory/levels?locationId=${user.locationId}`).catch((): StockLevelRow[] => [])
      : Promise.resolve<StockLevelRow[]>([]),
  ]);

  return (
    <MyDayClient
      initialSchedule={schedule}
      services={services}
      initialTips={tips}
      products={products}
      locationId={user.locationId}
      barberName={`${user.firstName} ${user.lastName}`.trim()}
    />
  );
};

export default MyDayPage;
