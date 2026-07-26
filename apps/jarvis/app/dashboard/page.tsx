import type { Metadata } from 'next';
import BrandHeader from '@/components/BrandHeader';
import DailyDashboard from '@/components/DailyDashboard';

export const metadata: Metadata = {
  title: 'Daily — Jarvis',
  description: "Motivation, tips, astrology and today's training session.",
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
      <BrandHeader active="dashboard" />
      <DailyDashboard />
    </main>
  );
}
