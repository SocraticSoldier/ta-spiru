import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: "Ta' Spiru — Premium Barbering & Car Detailing",
  description: 'Book your cut, your wash, or both at once — across five locations in Malta.',
};

const RootLayout = ({ children }: { children: ReactNode }): ReactNode => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
