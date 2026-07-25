'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { motion } from 'framer-motion';
import type { LocationSummary } from '@ta-spiru/shared';

const PIN_LENGTH = 4;

export const StationLoginClient = ({ locations }: { locations: LocationSummary[] }): JSX.Element => {
  const router = useRouter();
  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (enteredPin: string): Promise<void> => {
      if (!locationId) return;
      setBusy(true);
      setError(null);
      const response = await fetch('/api/session/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, pin: enteredPin }),
      });
      if (response.ok) {
        router.push('/my-day');
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'PIN not recognised');
      setPin('');
      setBusy(false);
    },
    [locationId, router],
  );

  const onKey = (digit: string): void => {
    if (busy) return;
    setError(null);
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void submit(next);
    }
  };

  if (locations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-4xl text-bronze-light">Ta&rsquo; Spiru</p>
        <p className="mt-4 text-white/50">No barber-operated branches are configured right now.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <p className="font-display text-4xl text-bronze-light">Ta&rsquo; Spiru</p>
      <p className="font-script mt-1 text-xl text-bronze">It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!</p>
      <p className="mt-6 text-white/60">This branch has no front desk — sign in with your station PIN.</p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {locations.map((location) => (
          <button
            key={location.id}
            type="button"
            onClick={() => { setLocationId(location.id); setPin(''); setError(null); }}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              locationId === location.id ? 'bg-white/15 text-white' : 'border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {location.name}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex w-full max-w-xs flex-col items-center"
      >
        <div className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <span
              key={index}
              className="h-4 w-4 rounded-full border border-white/25"
              style={{ backgroundColor: index < pin.length ? '#cfae7b' : 'transparent' }}
            />
          ))}
        </div>
        <p className="mt-3 h-5 text-sm text-red-400">{error ?? ''}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={busy}
              onClick={() => onKey(digit)}
              className="font-display h-20 w-20 rounded-full border border-white/10 bg-graphite text-3xl transition enabled:hover:border-bronze enabled:active:bg-white/10 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setPin('')}
            className="h-20 w-20 rounded-full border border-white/10 text-sm text-white/50 transition enabled:hover:text-white disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onKey('0')}
            className="font-display h-20 w-20 rounded-full border border-white/10 bg-graphite text-3xl transition enabled:hover:border-bronze enabled:active:bg-white/10 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPin((current) => current.slice(0, -1))}
            className="h-20 w-20 rounded-full border border-white/10 text-2xl text-white/50 transition enabled:hover:text-white disabled:opacity-50"
            aria-label="Backspace"
          >
            ⌫
          </button>
        </div>
      </motion.div>
    </main>
  );
};
