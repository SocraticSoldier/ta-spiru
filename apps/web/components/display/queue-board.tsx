'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { QueueEntryView, QueueSnapshot } from '@ta-spiru/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const POLL_INTERVAL_MS = 5000;

interface QueueBoardProps {
  locationSlug: string;
}

const useQueueSnapshot = (locationSlug: string): { snapshot: QueueSnapshot | null; error: boolean } => {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_URL}/api/v1/queue/board/${locationSlug}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        const data = (await response.json()) as QueueSnapshot;
        if (!cancelled) {
          setSnapshot(data);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [locationSlug]);

  return { snapshot, error };
};

const useClock = (): string => {
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = (): void =>
      setNow(
        new Date().toLocaleTimeString('en-MT', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Malta',
        }),
      );
    tick();
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

const EntryCard = ({ entry }: { entry: QueueEntryView }): JSX.Element => {
  const called = entry.status === 'CALLED';
  const inService = entry.status === 'IN_SERVICE';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -32, transition: { duration: 0.3 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`flex items-center gap-5 rounded-2xl border p-5 ${
        called
          ? 'animate-pulse border-bronze bg-bronze/15'
          : inService
            ? 'border-white/10 bg-white/5'
            : 'border-white/10 bg-graphite'
      }`}
    >
      <div
        className={`font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ${
          called ? 'bg-bronze text-graphite-deep' : 'bg-white/10 text-white/80'
        }`}
      >
        {called ? '→' : inService ? '✂' : entry.position ?? '·'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-medium">{entry.displayName}</p>
        <p className="truncate text-base text-white/50">
          {entry.serviceName}
          {entry.vehicleReg ? ` · ${entry.vehicleReg}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {called ? (
          <p className="text-lg font-semibold uppercase tracking-widest text-bronze-light">
            You&apos;re up
          </p>
        ) : inService ? (
          <p className="text-base uppercase tracking-widest text-white/40">In service</p>
        ) : entry.estimatedWaitMin !== null ? (
          <p className="font-display text-2xl text-white/60">~{entry.estimatedWaitMin} min</p>
        ) : null}
      </div>
    </motion.li>
  );
};

const Column = ({ title, entries }: { title: string; entries: QueueEntryView[] }): JSX.Element => (
  <section className="flex min-w-0 flex-1 flex-col">
    <h2 className="mb-4 font-sans text-sm font-semibold uppercase tracking-[0.35em] text-white/40">{title}</h2>
    <ul className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </ul>
    {entries.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-lg text-white/30">
        No wait — walk right in
      </div>
    ) : null}
  </section>
);

export const QueueBoard = ({ locationSlug }: QueueBoardProps): JSX.Element => {
  const { snapshot, error } = useQueueSnapshot(locationSlug);
  const clock = useClock();

  const barberEntries = snapshot?.entries.filter((entry) => entry.serviceKind === 'BARBER') ?? [];
  const washEntries = snapshot?.entries.filter((entry) => entry.serviceKind === 'WASH') ?? [];

  return (
    <main className="flex min-h-screen flex-col px-10 py-8">
      <header className="mb-8 flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <p className="font-display text-2xl text-bronze-light">Ta&apos; Spiru</p>
          <h1 className="mt-1 text-5xl">
            {snapshot?.locationName ?? locationSlug.replaceAll('-', ' ')}
          </h1>
        </div>
        <div className="text-right">
          <p className="font-display text-5xl text-white/90">{clock}</p>
          <p className="mt-1 text-sm text-white/40">
            {error ? 'Reconnecting…' : 'Live queue'}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-10 lg:flex-row">
        <Column title="Barbering" entries={barberEntries} />
        <Column title="Car Detailing" entries={washEntries} />
      </div>

      <footer className="mt-8 border-t border-white/10 pt-4 text-center text-sm text-white/30">
        Join the queue in the Ta&apos; Spiru app · taspiru.com
      </footer>
    </main>
  );
};
