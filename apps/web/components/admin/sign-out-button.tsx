'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { JSX } from 'react';

export const SignOutButton = ({ redirectTo = '/admin/login' }: { redirectTo?: string }): JSX.Element => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async (): Promise<void> => {
    setBusy(true);
    await fetch('/api/session', { method: 'DELETE' });
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:border-bronze hover:text-bronze-light disabled:opacity-50"
    >
      Sign out
    </button>
  );
};
