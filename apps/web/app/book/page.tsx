import Link from 'next/link';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { BookingWizard } from '@/components/booking/booking-wizard';

export const metadata: Metadata = { title: "Ta' Spiru — Book" };

const BookPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string }>;
}): Promise<JSX.Element> => {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-display text-3xl text-bronze-light">
          Ta&rsquo; Spiru
        </Link>
        <Link href="/account" className="text-sm text-white/50 transition hover:text-white">
          My account →
        </Link>
      </div>
      <p className="font-script mt-1 text-xl text-bronze">
        It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
      </p>
      <h1 className="mt-8 text-5xl">Book your slot</h1>
      <div className="mt-8">
        <BookingWizard initialStream={params.stream} />
      </div>
    </main>
  );
};

export default BookPage;
