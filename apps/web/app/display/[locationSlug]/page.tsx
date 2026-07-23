import type { Metadata } from 'next';
import type { JSX } from 'react';
import { QueueBoard } from '@/components/display/queue-board';

export const metadata: Metadata = {
  title: "Ta' Spiru — Live Queue",
  robots: { index: false, follow: false },
};

const DisplayPage = async ({
  params,
}: {
  params: Promise<{ locationSlug: string }>;
}): Promise<JSX.Element> => {
  const { locationSlug } = await params;
  return <QueueBoard locationSlug={locationSlug} />;
};

export default DisplayPage;
