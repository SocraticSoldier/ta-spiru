'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { motion } from 'framer-motion';

const LoginPage = (): JSX.Element => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      router.push('/admin');
      router.refresh();
      return;
    }
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Sign in failed');
    setSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-graphite p-8"
      >
        <p className="font-display text-4xl text-bronze-light">Ta&apos; Spiru</p>
        <p className="font-script mt-1 text-xl text-bronze">
          It&apos;s not just a haircut, it&apos;s a lifestyle!
        </p>
        <h1 className="mt-6 text-3xl">Staff Portal</h1>

        <label className="mt-8 block text-sm text-white/70" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 outline-none focus:border-bronze"
        />

        <label className="mt-4 block text-sm text-white/70" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 outline-none focus:border-bronze"
        />

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-bronze py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </motion.form>
    </main>
  );
};

export default LoginPage;
