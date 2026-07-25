import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { JSX } from 'react';
import type { AuthUser, BarberScheduleRow, ServiceSummary, TipsSummary } from '@ta-spiru/shared';
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
  const [schedule, services, tips] = await Promise.all([
    apiFetch<BarberScheduleRow[]>(`/barbers/me/schedule?date=${date}`).catch((): BarberScheduleRow[] => []),
    apiFetch<ServiceSummary[]>('/services?kind=BARBER').catch((): ServiceSummary[] => []),
    apiFetch<TipsSummary>('/team/me/tips').catch((): TipsSummary => ({ totalCents: 0, entries: [] })),
  ]);

  return (
    <MyDayClient
      initialSchedule={schedule}
      services={services}
      initialTips={tips}
      barberName={`${user.firstName} ${user.lastName}`.trim()}
    />
  );
};

export default MyDayPage;
