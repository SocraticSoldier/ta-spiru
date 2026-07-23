import type { Metadata } from 'next';
import type { JSX } from 'react';
import { ServiceStream } from '@/components/service-stream';

export const metadata: Metadata = { title: "Ta' Spiru — Car Detailing" };

const WashPage = (): Promise<JSX.Element> =>
  ServiceStream({
    kind: 'WASH',
    eyebrow: 'Car Detailing',
    title: 'The Car Wash',
    copy: 'From express exterior washes to premium valeting and ceramic coating — and the Combo Wash & Cut that details your car while you get sharp.',
  });

export default WashPage;
