import Link from 'next/link';
import type { JSX } from 'react';
import type { LocationSummary, ServiceKindName, ServiceSummary } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { KIND_COLORS, locationColor } from '@/lib/colors';
import { formatEuro } from '@/lib/format';

interface ServiceStreamProps {
  kind: ServiceKindName;
  eyebrow: string;
  title: string;
  copy: string;
}

const getData = async (
  kind: ServiceKindName,
): Promise<{ services: ServiceSummary[]; locations: LocationSummary[] }> => {
  try {
    const [services, locations] = await Promise.all([
      apiFetch<ServiceSummary[]>(`/services?kind=${kind}`),
      apiFetch<LocationSummary[]>('/locations'),
    ]);
    return { services, locations };
  } catch {
    return { services: [], locations: [] };
  }
};

export const ServiceStream = async ({ kind, eyebrow, title, copy }: ServiceStreamProps): Promise<JSX.Element> => {
  const { services, locations } = await getData(kind);
  const accent = KIND_COLORS[kind];
  const branches =
    kind === 'WASH' ? locations.filter((location) => location.bayCount > 0) : locations;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm text-white/40 transition hover:text-white/70">
        ← Ta&rsquo; Spiru
      </Link>
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.4em]" style={{ color: accent.text }}>
        {eyebrow}
      </p>
      <h1 className="mt-3 text-5xl sm:text-6xl">{title}</h1>
      <p className="mt-4 max-w-xl text-lg text-white/60">{copy}</p>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-2xl border border-white/10 p-6 transition hover:border-white/25"
            style={{ background: `linear-gradient(140deg, ${accent.soft}, rgba(28,28,30,0.9) 55%)` }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg font-medium">{service.name}</p>
              <p className="text-lg font-semibold" style={{ color: accent.text }}>
                {formatEuro(service.priceCents)}
              </p>
            </div>
            <p className="mt-2 text-sm text-white/50">
              {service.durationMin} min
              {service.isComboEligible ? ' · Combo Wash & Cut eligible' : ''}
            </p>
          </div>
        ))}
        {services.length === 0 ? (
          <p className="text-white/50 sm:col-span-2">Services are loading — check back in a moment.</p>
        ) : null}
      </div>

      <h2 className="mt-16 text-3xl">Where to find us</h2>
      <div className="mt-6 flex flex-wrap gap-3">
        {branches.map((location) => (
          <div
            key={location.id}
            className="flex items-center gap-2.5 rounded-full border border-white/10 bg-graphite px-4 py-2 text-sm"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: locationColor(location.slug) }}
            />
            {location.name}
            {kind === 'WASH' ? (
              <span className="text-white/40">
                · {location.bayCount} bay{location.bayCount === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="text-white/40">· {location.chairCount} chairs</span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-14 text-sm text-white/40">
        Book in the Ta&rsquo; Spiru app — or walk in and join the live queue on the door display.
      </p>
    </main>
  );
};
