import type { JSX } from 'react';

interface PlaceholderProps {
  title: string;
  phase: string;
  description: string;
}

export const Placeholder = ({ title, phase, description }: PlaceholderProps): JSX.Element => (
  <section>
    <h1 className="text-2xl font-semibold">{title}</h1>
    <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-graphite p-10 text-center">
      <p className="text-sm uppercase tracking-[0.25em] text-bronze">{phase}</p>
      <p className="mx-auto mt-3 max-w-md text-white/60">{description}</p>
    </div>
  </section>
);
