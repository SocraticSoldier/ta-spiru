'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import { restoreVault, unlockVault, type VaultResult } from '@/app/admin/(portal)/actions';
import { LEDGER_COLORS } from '@/lib/colors';
import { formatEuro, LEDGER_TAG_LABELS } from '@/lib/format';

const formatPunch = (iso: string): string =>
  new Date(iso).toLocaleString('en-MT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Malta',
  });

export const VaultPanel = (): JSX.Element => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<VaultResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const unlock = async (): Promise<void> => {
    if (!code) return;
    setBusy(true);
    setRestoreMessage(null);
    const outcome = await unlockVault(code);
    setResult(outcome);
    setCode('');
    setBusy(false);
  };

  const restore = async (): Promise<void> => {
    const restoreCode = window.prompt('Enter the vault code to restore sales');
    if (!restoreCode) return;
    const outcome = await restoreVault(restoreCode);
    if (outcome.ok) {
      setResult(null);
      setRestoreMessage('Sales restored — unlock again to view.');
    } else {
      setRestoreMessage(outcome.message ?? 'Wrong code');
    }
  };

  if (!result) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-5 sm:col-span-2 lg:col-span-4">
        <p className="text-sm text-white/60">Sales are hidden by default — only you can reveal them.</p>
        {restoreMessage ? <p className="mt-2 text-sm text-bronze-light">{restoreMessage}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Vault code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void unlock()}
            className="rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void unlock()}
            className="rounded-lg bg-bronze px-4 py-2 font-medium text-graphite-deep transition hover:bg-bronze-light disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 sm:col-span-2 lg:col-span-4">
        <p className="text-sm text-red-200">{result.message}</p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (result.status === 'wiped') {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-6 text-center sm:col-span-2 lg:col-span-4">
        <p className="font-display text-2xl text-red-300">Sales wiped</p>
        <p className="mt-2 text-sm text-white/60">
          Monetary values have been removed from every screen until you restore them.
        </p>
        <button
          type="button"
          onClick={() => void restore()}
          className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:text-white"
        >
          Restore (owner only)
        </button>
      </div>
    );
  }

  return (
    <>
      {result.revenue.lines.map((line) => {
        const accent = LEDGER_COLORS[line.ledgerTag] ?? LEDGER_COLORS.BARBER_SERVICES;
        return (
          <div
            key={line.ledgerTag}
            className="rounded-2xl border border-white/10 p-5"
            style={{
              background: `linear-gradient(150deg, ${accent?.soft ?? 'transparent'}, rgba(28,28,30,0.85) 60%)`,
              boxShadow: `inset 0 2px 0 ${accent?.solid ?? 'transparent'}`,
            }}
          >
            <p className="text-sm text-white/60">{LEDGER_TAG_LABELS[line.ledgerTag] ?? line.ledgerTag}</p>
            <p className="font-display mt-2 text-4xl" style={{ color: accent?.text }}>
              {formatEuro(line.amountCents)}
            </p>
            <p className="mt-1 text-xs text-white/40">{line.splitCount} ledger entries</p>
          </div>
        );
      })}
      <div className="rounded-2xl border border-white/10 bg-graphite p-5 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">Total takings</p>
          <p className="font-display text-3xl text-bronze-light">{formatEuro(result.revenue.totalCents)}</p>
        </div>
        {result.timeclock.length ? (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Clock in / out — last 7 days, internal only</p>
            <div className="mt-2 divide-y divide-white/5">
              {result.timeclock.slice(0, 15).map((entry, index) => (
                <div key={index} className="flex items-center justify-between py-2 text-sm">
                  <span>{entry.name}</span>
                  <span className="text-white/50">{formatPunch(entry.clockInAt)}</span>
                  <span className="font-display text-bronze-light">
                    {entry.minutes != null ? `${Math.floor(entry.minutes / 60)}h ${entry.minutes % 60}m` : 'active'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:text-white"
        >
          Lock again
        </button>
      </div>
    </>
  );
};
