'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { JSX } from 'react';
import { AuthForm } from '@/components/auth-form';

const SignInInner = (): JSX.Element => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const target = next && next.startsWith('/') ? next : '/account';

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-graphite p-8">
        <Link href="/" className="font-display text-4xl text-bronze-light">
          Ta&rsquo; Spiru
        </Link>
        <p className="font-script mt-1 text-xl text-bronze">
          It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
        </p>
        <div className="mt-7">
          <AuthForm
            onSuccess={() => {
              router.push(target);
              router.refresh();
            }}
          />
        </div>
      </div>
    </main>
  );
};

const SignInPage = (): JSX.Element => (
  <Suspense>
    <SignInInner />
  </Suspense>
);

export default SignInPage;
