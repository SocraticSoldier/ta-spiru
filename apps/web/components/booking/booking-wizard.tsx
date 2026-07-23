'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AvailabilitySlot,
  ComboSlot,
  LocationSummary,
  ServiceSummary,
} from '@ta-spiru/shared';
import {
  bookCombo,
  bookSingle,
  type BookingActionResult,
} from '@/app/book/actions';
import { AuthForm } from '@/components/auth-form';
import { KIND_COLORS } from '@/lib/colors';
import { formatEuro } from '@/lib/format';
import { formatTimeMalta, shiftDate, todayMalta } from '@/lib/time';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Stream = 'CUT' | 'WASH' | 'COMBO';

interface StreamSpec {
  key: Stream;
  title: string;
  mark: string;
  copy: string;
  accent: { solid: string; soft: string; text: string };
}

const STREAMS: readonly StreamSpec[] = [
  {
    key: 'CUT',
    title: 'A Cut',
    mark: 'The Barber',
    copy: 'Fades, cuts, beard sculpting and treatments.',
    accent: KIND_COLORS.BARBER,
  },
  {
    key: 'WASH',
    title: 'A Wash',
    mark: 'The Car Wash',
    copy: 'Washes, valeting and detailing for your car.',
    accent: KIND_COLORS.WASH,
  },
  {
    key: 'COMBO',
    title: 'Combo Wash & Cut',
    mark: 'The Barber + The Car Wash',
    copy: 'Your car detailed while you get sharp — one slot, both done.',
    accent: KIND_COLORS.BARBER,
  },
];

const fetchJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`${API_URL}/api/v1${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  return (await response.json()) as T;
};

const stepCard = 'rounded-2xl border border-white/10 bg-graphite p-6';
const chip = (active: boolean): string =>
  `rounded-full px-3.5 py-1.5 text-sm transition ${
    active ? 'bg-white/15 text-white' : 'border border-white/10 text-white/60 hover:text-white'
  }`;

interface SelectedSlot {
  startsAt: string;
  barberId: string | null;
  barberName: string | null;
  washBayId: string | null;
  label: string;
}

export const BookingWizard = ({ initialStream }: { initialStream?: string }): JSX.Element => {
  const [stream, setStream] = useState<Stream | null>(
    initialStream === 'CUT' || initialStream === 'WASH' || initialStream === 'COMBO'
      ? initialStream
      : null,
  );
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [barberServiceId, setBarberServiceId] = useState<string | null>(null);
  const [washServiceId, setWashServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(shiftDate(todayMalta(), 1));
  const [slots, setSlots] = useState<SelectedSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<SelectedSlot | null>(null);
  const [vehicleReg, setVehicleReg] = useState('');

  const [phase, setPhase] = useState<'form' | 'auth' | 'booking' | 'done'>('form');
  const [result, setResult] = useState<BookingActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<LocationSummary[]>('/locations'),
      fetchJson<ServiceSummary[]>('/services'),
    ])
      .then(([loadedLocations, loadedServices]) => {
        setLocations(loadedLocations);
        setServices(loadedServices);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const spec = STREAMS.find((candidate) => candidate.key === stream) ?? null;
  const needsWashBay = stream === 'WASH' || stream === 'COMBO';
  const branches = needsWashBay ? locations.filter((location) => location.bayCount > 0) : locations;
  const barberServices = services.filter(
    (service) => service.kind === 'BARBER' && (stream !== 'COMBO' || service.isComboEligible),
  );
  const washServices = services.filter(
    (service) => service.kind === 'WASH' && (stream !== 'COMBO' || service.isComboEligible),
  );
  const dates = useMemo(() => {
    const today = todayMalta();
    return Array.from({ length: 14 }, (_, index) => shiftDate(today, index + 1));
  }, []);

  const servicesChosen =
    stream === 'CUT' ? barberServiceId !== null
    : stream === 'WASH' ? washServiceId !== null
    : barberServiceId !== null && washServiceId !== null;

  const loadSlots = useCallback(async (): Promise<void> => {
    if (!stream || !locationId || !servicesChosen) {
      return;
    }
    setSlotsLoading(true);
    setSlot(null);
    setSlots(null);
    try {
      if (stream === 'COMBO') {
        const combo = await fetchJson<ComboSlot[]>(
          `/bookings/combo-availability?locationId=${locationId}&date=${date}&barberServiceId=${barberServiceId}&washServiceId=${washServiceId}`,
        );
        setSlots(
          combo.map((entry) => ({
            startsAt: entry.startsAt,
            barberId: entry.barberId,
            barberName: entry.barberName,
            washBayId: entry.washBayId,
            label: `${formatTimeMalta(entry.startsAt)} · ${entry.barberName} · ${entry.washBayName}`,
          })),
        );
      } else {
        const serviceId = stream === 'CUT' ? barberServiceId : washServiceId;
        const single = await fetchJson<AvailabilitySlot[]>(
          `/bookings/availability?locationId=${locationId}&date=${date}&serviceId=${serviceId}`,
        );
        setSlots(
          single.map((entry) => ({
            startsAt: entry.startsAt,
            barberId: entry.barberId,
            barberName: entry.barberName,
            washBayId: entry.resourceId,
            label: `${formatTimeMalta(entry.startsAt)}${entry.barberName ? ` · ${entry.barberName}` : ''}${entry.resourceName ? ` · ${entry.resourceName}` : ''}`,
          })),
        );
      }
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [stream, locationId, servicesChosen, date, barberServiceId, washServiceId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const totalCents =
    (stream !== 'WASH' && barberServiceId
      ? (barberServices.find((service) => service.id === barberServiceId)?.priceCents ?? 0)
      : 0) +
    (stream !== 'CUT' && washServiceId
      ? (washServices.find((service) => service.id === washServiceId)?.priceCents ?? 0)
      : 0);

  const submitBooking = useCallback(async (): Promise<void> => {
    if (!stream || !locationId || !slot) {
      return;
    }
    setPhase('booking');
    setError(null);
    const outcome =
      stream === 'COMBO'
        ? await bookCombo({
            locationId,
            startsAt: slot.startsAt,
            barberServiceId: barberServiceId ?? '',
            washServiceId: washServiceId ?? '',
            barberId: slot.barberId ?? '',
            washBayId: slot.washBayId ?? '',
            vehicleReg,
          })
        : await bookSingle({
            locationId,
            serviceId: (stream === 'CUT' ? barberServiceId : washServiceId) ?? '',
            startsAt: slot.startsAt,
            barberId: slot.barberId,
            washBayId: slot.washBayId,
            vehicleReg: needsWashBay ? vehicleReg : undefined,
          });

    if (outcome.status === 'auth-required') {
      setPhase('auth');
      return;
    }
    if (outcome.status === 'error') {
      setPhase('form');
      setError(outcome.message);
      void loadSlots();
      return;
    }
    setResult(outcome);
    setPhase('done');
  }, [stream, locationId, slot, barberServiceId, washServiceId, vehicleReg, needsWashBay, loadSlots]);

  if (loadFailed) {
    return (
      <p className="rounded-xl border border-dashed border-white/15 p-8 text-white/50">
        Booking is temporarily unavailable — please try again shortly.
      </p>
    );
  }

  if (phase === 'done' && result && result.status === 'booked') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${stepCard} text-center`}
      >
        <p className="font-script text-4xl text-bronze-light">See you soon!</p>
        <p className="mt-4 text-lg">
          Booked for{' '}
          <span className="font-display text-bronze-light">
            {formatTimeMalta(result.startsAt)}
          </span>{' '}
          on {result.startsAt.slice(0, 10)}
          {result.comboGroupId ? ' — Combo Wash & Cut' : ''}
        </p>
        <p className="font-display mt-3 text-4xl text-bronze-light">{formatEuro(result.amountCents)}</p>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/50">
          Payment reference <span className="font-mono text-white/70">{result.paymentReference}</span>.
          Your booking is held as pending and confirms the moment Trust Payments settles the charge.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/account" className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light">
            My bookings
          </Link>
          <Link href="/" className="rounded-lg border border-white/15 px-5 py-2.5 text-white/70 transition hover:text-white">
            Home
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1 — what */}
      <div className={stepCard}>
        <h2 className="text-2xl">What are you booking?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {STREAMS.map((candidate) => (
            <button
              key={candidate.key}
              type="button"
              onClick={() => {
                setStream(candidate.key);
                setSlot(null);
                setSlots(null);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                stream === candidate.key ? 'border-white/40' : 'border-white/10 hover:border-white/25'
              }`}
              style={{
                background:
                  candidate.key === 'COMBO'
                    ? `linear-gradient(135deg, ${KIND_COLORS.BARBER.soft}, ${KIND_COLORS.WASH.soft})`
                    : candidate.accent.soft,
              }}
            >
              <span className="font-script block text-xl" style={{ color: candidate.accent.text }}>
                {candidate.mark}
              </span>
              <span className="mt-1 block font-medium">{candidate.title}</span>
              <span className="mt-1 block text-sm text-white/55">{candidate.copy}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2 — where */}
      {stream ? (
        <div className={stepCard}>
          <h2 className="text-2xl">Which branch?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {branches.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => setLocationId(location.id)}
                className={chip(locationId === location.id)}
              >
                {location.name}
              </button>
            ))}
          </div>
          {needsWashBay && branches.length < locations.length ? (
            <p className="mt-3 text-xs text-white/40">
              Showing branches with wash bays.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 3 — services */}
      {stream && locationId ? (
        <div className={stepCard}>
          <h2 className="text-2xl">
            {stream === 'COMBO' ? 'Pick your cut and your wash' : 'Pick a service'}
          </h2>
          {stream !== 'WASH' ? (
            <div className="mt-4">
              {stream === 'COMBO' ? (
                <p className="font-script mb-2 text-lg text-bronze-light">The Barber</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {barberServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setBarberServiceId(service.id)}
                    className={chip(barberServiceId === service.id)}
                  >
                    {service.name} · {formatEuro(service.priceCents)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {stream !== 'CUT' ? (
            <div className="mt-4">
              {stream === 'COMBO' ? (
                <p className="font-script mb-2 text-lg text-wash-light">The Car Wash</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {washServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setWashServiceId(service.id)}
                    className={chip(washServiceId === service.id)}
                  >
                    {service.name} · {formatEuro(service.priceCents)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 4 — when */}
      {stream && locationId && servicesChosen ? (
        <div className={stepCard}>
          <h2 className="text-2xl">When?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {dates.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setDate(candidate)}
                className={`${chip(date === candidate)} font-display`}
              >
                {candidate.slice(5)}
              </button>
            ))}
          </div>
          <div className="mt-5 min-h-[52px]">
            {slotsLoading ? (
              <p className="text-sm text-white/50">Finding free slots…</p>
            ) : slots && slots.length === 0 ? (
              <p className="text-sm text-white/50">
                Nothing free that day — try another date or branch.
              </p>
            ) : slots ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((candidate) => (
                  <button
                    key={candidate.startsAt}
                    type="button"
                    onClick={() => setSlot(candidate)}
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      slot?.startsAt === candidate.startsAt
                        ? 'text-graphite-deep'
                        : 'text-white/80 hover:text-white'
                    }`}
                    style={{
                      background:
                        slot?.startsAt === candidate.startsAt
                          ? (spec?.accent.solid ?? '#b08d57')
                          : (spec?.accent.soft ?? 'rgba(255,255,255,0.06)'),
                      boxShadow: `inset 0 0 0 1px ${spec?.accent.solid ?? '#b08d57'}33`,
                    }}
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 5 — confirm */}
      <AnimatePresence>
        {stream && locationId && servicesChosen && slot ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={stepCard}
          >
            <h2 className="text-2xl">Confirm</h2>
            <p className="mt-3 text-white/70">
              {formatTimeMalta(slot.startsAt)} on {date} ·{' '}
              {locations.find((location) => location.id === locationId)?.name}
              {slot.barberName ? ` · with ${slot.barberName}` : ''}
            </p>
            <p className="font-display mt-2 text-4xl text-bronze-light">{formatEuro(totalCents)}</p>
            {needsWashBay ? (
              <input
                aria-label="Vehicle registration"
                placeholder="Vehicle registration (e.g. ABC 123)"
                value={vehicleReg}
                onChange={(event) => setVehicleReg(event.target.value)}
                maxLength={16}
                className="mt-4 w-full max-w-xs rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-white outline-none focus:border-bronze"
              />
            ) : null}
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

            {phase === 'auth' ? (
              <div className="mt-6 max-w-sm rounded-xl border border-white/10 bg-graphite-deep/60 p-5">
                <p className="mb-4 text-sm text-white/60">
                  Sign in or create an account to lock in your slot.
                </p>
                <AuthForm onSuccess={() => void submitBooking()} />
              </div>
            ) : (
              <button
                type="button"
                disabled={phase === 'booking'}
                onClick={() => void submitBooking()}
                className="mt-6 rounded-lg bg-bronze px-6 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light disabled:opacity-50"
              >
                {phase === 'booking' ? 'Booking…' : 'Book it'}
              </button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
