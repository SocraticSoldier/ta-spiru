'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { KioskStaffMember } from '@ta-spiru/shared';
import { punchStaff, type PunchActionResult } from '@/app/kiosk/actions';
import { formatTimeMalta } from '@/lib/time';

const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  RECEPTIONIST: 'Reception',
  BARBER: 'Barber',
  WASH_ATTENDANT: 'Car Wash',
};

const ROLE_ACCENT: Record<string, string> = {
  MANAGER: '#cfae7b',
  RECEPTIONIST: '#a78bfa',
  BARBER: '#b08d57',
  WASH_ATTENDANT: '#3fc1b0',
};

const PIN_LENGTH = 4;

interface KioskClientProps {
  locationId: string;
  locationName: string;
  staff: KioskStaffMember[];
}

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

const StaffGrid = ({
  staff,
  onPick,
}: {
  staff: KioskStaffMember[];
  onPick: (member: KioskStaffMember) => void;
}): JSX.Element => (
  <div className="grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {staff.map((member) => (
      <button
        key={member.id}
        type="button"
        disabled={!member.hasPin}
        onClick={() => onPick(member)}
        className="group relative flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-graphite p-5 text-left transition enabled:hover:border-white/30 disabled:opacity-40"
        style={{ boxShadow: `inset 3px 0 0 ${ROLE_ACCENT[member.role] ?? '#9ca3af'}` }}
      >
        <span
          className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: member.clockedIn ? '#4ade80' : 'rgba(255,255,255,0.15)' }}
          title={member.clockedIn ? 'On shift' : 'Off'}
        />
        <span className="text-lg font-medium">{member.name}</span>
        <span className="text-sm text-white/50">{ROLE_LABELS[member.role] ?? member.role}</span>
        <span className="mt-1 text-xs" style={{ color: member.clockedIn ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
          {member.clockedIn
            ? `On since ${member.clockedInSince ? formatTimeMalta(member.clockedInSince) : ''}`
            : member.hasPin
              ? 'Tap to clock in'
              : 'No PIN set'}
        </span>
      </button>
    ))}
  </div>
);

const Numpad = ({
  member,
  pin,
  onKey,
  onBack,
  onClear,
  onCancel,
  busy,
  error,
}: {
  member: KioskStaffMember;
  pin: string;
  onKey: (digit: string) => void;
  onBack: () => void;
  onClear: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}): JSX.Element => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.96 }}
    className="flex w-full max-w-xs flex-col items-center"
  >
    <p className="text-sm text-white/50">{member.clockedIn ? 'Clock out' : 'Clock in'}</p>
    <p className="mt-1 text-2xl font-medium">{member.name}</p>

    <div className="mt-6 flex gap-3">
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
        onClick={onClear}
        disabled={busy}
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
        onClick={onBack}
        disabled={busy}
        className="h-20 w-20 rounded-full border border-white/10 text-2xl text-white/50 transition enabled:hover:text-white disabled:opacity-50"
        aria-label="Backspace"
      >
        ⌫
      </button>
    </div>

    <button
      type="button"
      onClick={onCancel}
      disabled={busy}
      className="mt-6 text-sm text-white/40 transition hover:text-white/70"
    >
      Cancel
    </button>
  </motion.div>
);

const ResultView = ({ result }: { result: Extract<PunchActionResult, { ok: true }> }): JSX.Element => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center text-center"
  >
    <div
      className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
      style={{ backgroundColor: result.action === 'CLOCK_IN' ? 'rgba(74,222,128,0.15)' : 'rgba(176,141,87,0.15)' }}
    >
      {result.action === 'CLOCK_IN' ? '👋' : '✓'}
    </div>
    <p className="font-script mt-6 text-4xl text-bronze-light">
      {result.action === 'CLOCK_IN' ? 'Welcome' : 'See you soon'}
    </p>
    <p className="mt-2 text-2xl">{result.name}</p>
    <p className="mt-1 text-white/50">
      {result.action === 'CLOCK_IN' ? 'Clocked in' : 'Clocked out'} at{' '}
      <span className="font-display text-bronze-light">{result.at ? formatTimeMalta(result.at) : ''}</span>
    </p>
  </motion.div>
);

export const KioskClient = ({ locationId, locationName, staff }: KioskClientProps): JSX.Element => {
  const clock = useClock();
  const [selected, setSelected] = useState<KioskStaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<PunchActionResult, { ok: true }> | null>(null);

  const reset = useCallback((): void => {
    setSelected(null);
    setPin('');
    setError(null);
    setBusy(false);
  }, []);

  const submit = useCallback(
    async (member: KioskStaffMember, enteredPin: string): Promise<void> => {
      setBusy(true);
      setError(null);
      const outcome = await punchStaff(member.id, locationId, enteredPin);
      if (outcome.ok) {
        setResult(outcome);
        setSelected(null);
        setPin('');
        setBusy(false);
        setTimeout(() => {
          setResult(null);
          // Full refresh so the grid's clocked-in dots reflect the punch.
          window.location.reload();
        }, 2600);
      } else {
        setError(outcome.message);
        setPin('');
        setBusy(false);
      }
    },
    [locationId],
  );

  const onKey = useCallback(
    (digit: string): void => {
      if (!selected || busy) {
        return;
      }
      setError(null);
      const next = (pin + digit).slice(0, PIN_LENGTH);
      setPin(next);
      if (next.length === PIN_LENGTH) {
        void submit(selected, next);
      }
    },
    [selected, busy, pin, submit],
  );

  return (
    <main className="flex min-h-screen flex-col px-6 py-8">
      <header className="flex items-start justify-between border-b border-white/10 pb-5">
        <div>
          <p className="font-display text-3xl text-bronze-light">Ta&rsquo; Spiru</p>
          <p className="font-script text-lg text-bronze">Staff clock-in</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl text-white/90">{clock}</p>
          <p className="text-sm text-white/40">{locationName}</p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center py-10">
        <AnimatePresence mode="wait">
          {result ? (
            <ResultView key="result" result={result} />
          ) : selected ? (
            <Numpad
              key="numpad"
              member={selected}
              pin={pin}
              onKey={onKey}
              onBack={() => setPin((current) => current.slice(0, -1))}
              onClear={() => setPin('')}
              onCancel={reset}
              busy={busy}
              error={error}
            />
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {staff.length === 0 ? (
                <p className="text-white/50">No staff assigned to this branch yet.</p>
              ) : (
                <StaffGrid staff={staff} onPick={(member) => setSelected(member)} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
};
