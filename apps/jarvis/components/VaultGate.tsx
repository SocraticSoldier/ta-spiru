'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function VaultGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassword('');
        // The gate is enforced on the server, so re-render from there.
        router.refresh();
      } else {
        setError(data.error ?? 'Could not unlock.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="w-full max-w-md rounded-xl border border-edge bg-ink-2 p-6 space-y-3">
        <h2 className="font-display font-semibold text-lg">Vault not set up</h2>
        <p className="text-sm text-muted">
          Set <code className="font-mono text-gold">JARVIS_VAULT_PASSWORD</code> in the server
          environment to enable this section. Until then it stays closed — it never falls open just
          because no password was configured.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-edge bg-ink-2 p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-lg">Locked</h2>
        <p className="text-sm text-muted">Enter the password to open this section.</p>
      </div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        aria-label="Vault password"
        placeholder="Password"
        className="w-full rounded-full border border-edge bg-ink-3 px-4 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-gold"
      />

      {error && <p className="text-sm text-crimson">{error}</p>}

      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-full border border-edge-2 bg-ink-3 px-4 py-2 text-sm text-text hover:border-gold transition disabled:opacity-50"
      >
        {busy ? 'Checking…' : 'Unlock'}
      </button>

      <p className="text-xs text-faint">
        The password is checked on the server and never stored in this app&rsquo;s code. Your browser
        only ever holds a short-lived token it cannot read.
      </p>
    </form>
  );
}
