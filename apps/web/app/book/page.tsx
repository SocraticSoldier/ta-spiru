import Link from 'next/link';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { BookingFlow } from '@/components/booking/booking-flow';

export const metadata: Metadata = { title: "Ta' Spiru — Book" };

const BookPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string }>;
}): Promise<JSX.Element> => {
  const params = await searchParams;
  // COMBO was folded into the barber journey — the car wash is a step in it now.
  const stream = params.stream === 'WASH' ? 'WASH' : 'CUT';

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="mx-auto mb-6 flex max-w-lg items-baseline justify-between">
        <Link href="/" className="font-display text-2xl text-bronze-light">
          Ta&rsquo; Spiru
        </Link>
        <Link href="/account" className="text-sm text-white/40 transition hover:text-white">
          My account
        </Link>
      </div>
      <BookingFlow stream={stream} />
    </main>
  );
};

export default BookPage;
