import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import BrandHeader from '@/components/BrandHeader';
import VaultContent from '@/components/VaultContent';
import VaultGate from '@/components/VaultGate';
import { VAULT_COOKIE, isVaultConfigured, verifyToken } from '@/lib/vault';

export const metadata: Metadata = {
  title: 'Vault — Jarvis',
  robots: { index: false, follow: false },
};

/** Never prerender or cache: the gate depends on the request's cookie. */
export const dynamic = 'force-dynamic';

export default async function VaultPage() {
  const cookieStore = await cookies();
  const unlocked = verifyToken(cookieStore.get(VAULT_COOKIE)?.value);

  return (
    <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
      <BrandHeader active="vault" />
      {/* The content component is only rendered — and therefore only sent to
          the browser — once the server has verified the session token. */}
      {unlocked ? <VaultContent /> : <VaultGate configured={isVaultConfigured()} />}
    </main>
  );
}
