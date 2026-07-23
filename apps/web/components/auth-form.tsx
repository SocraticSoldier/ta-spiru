'use client';

import { useState } from 'react';
import type { FormEvent, JSX } from 'react';

type Mode = 'signin' | 'register';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze';

export const AuthForm = ({ onSuccess }: { onSuccess: () => void }): JSX.Element => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const endpoint = mode === 'signin' ? '/api/session' : '/api/session/register';
    const body =
      mode === 'signin' ? { email, password } : { email, password, firstName, lastName };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      onSuccess();
      return;
    }
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Something went wrong — try again');
    setBusy(false);
  };

  return (
    <div>
      <div className="flex gap-2">
        {(['signin', 'register'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setMode(candidate)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              mode === candidate
                ? 'bg-bronze/20 text-bronze-light'
                : 'border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {candidate === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        {mode === 'register' ? (
          <div className="grid grid-cols-2 gap-3">
            <input
              aria-label="First name"
              placeholder="First name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={inputClass}
            />
            <input
              aria-label="Last name"
              placeholder="Last name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={inputClass}
            />
          </div>
        ) : null}
        <input
          aria-label="Email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
        <input
          aria-label="Password"
          type="password"
          placeholder={mode === 'register' ? 'Password (min 8 characters)' : 'Password'}
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-bronze py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light disabled:opacity-50"
        >
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
};
