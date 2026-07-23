import type { Metadata } from 'next';
import type { JSX } from 'react';
import { ServiceStream } from '@/components/service-stream';

export const metadata: Metadata = { title: "Ta' Spiru — Barbering" };

const BarberPage = (): Promise<JSX.Element> =>
  ServiceStream({
    kind: 'BARBER',
    eyebrow: 'Barbering',
    title: 'The Barber',
    copy: 'Fades, traditional and modern cuts, beard sculpting with hot towels, and deep-cleansing treatments — across five branches in Malta.',
  });

export default BarberPage;
