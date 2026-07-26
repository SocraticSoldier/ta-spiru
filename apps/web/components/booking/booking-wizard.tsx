'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AvailabilitySlot,
  BarberSummary,
  LocationSummary,
  ServiceSummary,
} from '@ta-spiru/shared';
import { bookSingle, bookVisit, type BookingActionResult } from '@/app/book/actions';
import { AuthForm } from '@/components/auth-form';
import { KIND_COLORS } from '@/lib/colors';
import { formatEuro } from '@/lib/format';
import { formatTimeMalta, shiftDate, todayMalta } from '@/lib/time';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Two journeys: the barber one walks Haircuts -> Beards -> Add-ons and ends with
 * the car wash at branches that have bays, and the wash-only one comes in from
 * the car wash side of the storefront.
 */
type Stream = 'CUT' | 'WASH';

const asStream = (raw: string | undefined): Stream | null => {
  // COMBO used to be its own journey; the wash card at Fgura is now that path.
  if (raw === 'CUT' || raw === 'COMBO') return 'CUT';
  if (raw === 'WASH') return 'WASH';
  return null;
};

interface Coords {
  lat: number;
  lng: number;
}

/** Great-circle distance in km — plenty precise for "which branch is closer". */
const distanceKm = (a: Coords, b: Coords): number => {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

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

interface BarberRating {
  average: number | null;
  count: number;
}

const priceLabel = (service: ServiceSummary): string =>
  service.isQuoteOnly ? 'On inspection' : formatEuro(service.priceCents);

/** One row on a service card. */
const ServiceRow = ({
  service,
  selected,
  onSelect,
}: {
  service: ServiceSummary;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
      selected
        ? 'border-bronze bg-bronze/10'
        : 'border-white/10 bg-graphite-deep/40 hover:border-white/25'
    }`}
  >
    <span className="min-w-0">
      <span className="block truncate font-medium">{service.name}</span>
      <span className="mt-0.5 block text-xs text-white/45">
        {service.durationMin} min
        {service.isComboEligible ? ' · Combo' : ''}
        {service.description ? ` · ${service.description}` : ''}
      </span>
    </span>
    <span className="shrink-0 text-sm text-bronze-light">{priceLabel(service)}</span>
  </button>
);

export const BookingWizard = ({ initialStream }: { initialStream?: string }): JSX.Element => {
  const [stream, setStream] = useState<Stream | null>(asStream(initialStream));
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberSummary[]>([]);
  const [ratings, setRatings] = useState<Record<string, BarberRating>>({});
  const [barberId, setBarberId] = useState<string | null>(null);
  const [barberChosen, setBarberChosen] = useState(false); // "Any barber" is a choice too

  const [haircutId, setHaircutId] = useState<string | null>(null);
  const [beardId, setBeardId] = useState<string | null>(null);
  const [beardSkipped, setBeardSkipped] = useState(false);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [addonsDone, setAddonsDone] = useState(false);
  const [washServiceId, setWashServiceId] = useState<string | null>(null);
  const [washDone, setWashDone] = useState(false);

  const [date, setDate] = useState<string>(shiftDate(todayMalta(), 1));
  const [slots, setSlots] = useState<SelectedSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<SelectedSlot | null>(null);
  const [vehicleReg, setVehicleReg] = useState('');

  const [phase, setPhase] = useState<'form' | 'auth' | 'booking' | 'done'>('form');
  const [result, setResult] = useState<BookingActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'granted' | 'denied' | 'unavailable'>('idle');

  const useMyLocation = (): void => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { timeout: 8000 },
    );
  };

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

  // The barber comes before the services now, so their list loads with the branch.
  useEffect(() => {
    if (!locationId || stream !== 'CUT') {
      setBarbers([]);
      return;
    }
    let cancelled = false;
    fetchJson<BarberSummary[]>(`/barbers?locationId=${locationId}`)
      .then((loaded) => {
        if (cancelled) return;
        setBarbers(loaded);
        loaded.forEach((barber) => {
          fetchJson<BarberRating>(`/reviews/barber/${barber.id}`)
            .then((rating) => {
              if (!cancelled) {
                setRatings((prev) => ({ ...prev, [barber.id]: rating }));
              }
            })
            .catch(() => undefined);
        });
      })
      .catch(() => {
        if (!cancelled) setBarbers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, stream]);

  const branch = locations.find((location) => location.id === locationId) ?? null;
  const branchHasWash = (branch?.bayCount ?? 0) > 0;
  const needsWashBay = stream === 'WASH' || (stream === 'CUT' && washServiceId !== null);

  const eligibleBranches = stream === 'WASH' ? locations.filter((l) => l.bayCount > 0) : locations;
  const branches = coords
    ? [...eligibleBranches].sort((a, b) => {
        const distA =
          a.latitude !== null && a.longitude !== null
            ? distanceKm(coords, { lat: a.latitude, lng: a.longitude })
            : Infinity;
        const distB =
          b.latitude !== null && b.longitude !== null
            ? distanceKm(coords, { lat: b.latitude, lng: b.longitude })
            : Infinity;
        return distA - distB;
      })
    : eligibleBranches;

  const inCategory = useCallback(
    (category: ServiceSummary['category']): ServiceSummary[] =>
      // The API already returns combos first, then the admin's own ordering.
      services.filter((service) => service.category === category),
    [services],
  );
  const haircuts = inCategory('HAIRCUT');
  const beards = inCategory('BEARD');
  const addons = inCategory('ADDON');
  const washes = inCategory('WASH');

  const dates = useMemo(() => {
    const today = todayMalta();
    return Array.from({ length: 14 }, (_, index) => shiftDate(today, index + 1));
  }, []);

  const chosenServices = useMemo((): ServiceSummary[] => {
    if (stream === 'WASH') {
      const wash = washes.find((service) => service.id === washServiceId);
      return wash ? [wash] : [];
    }
    const picked: ServiceSummary[] = [];
    const haircut = haircuts.find((service) => service.id === haircutId);
    if (haircut) picked.push(haircut);
    const beard = beards.find((service) => service.id === beardId);
    if (beard) picked.push(beard);
    for (const id of addonIds) {
      const addon = addons.find((service) => service.id === id);
      if (addon) picked.push(addon);
    }
    const wash = washes.find((service) => service.id === washServiceId);
    if (wash) picked.push(wash);
    return picked;
  }, [stream, haircuts, beards, addons, washes, haircutId, beardId, addonIds, washServiceId]);

  const totalCents = chosenServices.reduce((sum, service) => sum + service.priceCents, 0);
  const hasQuoteOnly = chosenServices.some((service) => service.isQuoteOnly);

  // Barber segments only — the wash runs in parallel on a bay.
  const barberServiceIds = useMemo(
    (): string[] =>
      [haircutId, beardId, ...addonIds].filter((id): id is string => Boolean(id)),
    [haircutId, beardId, addonIds],
  );

  // Which cards have been dealt with, in order.
  const readyForBeard = stream === 'CUT' && haircutId !== null;
  const readyForAddons = readyForBeard && (beardId !== null || beardSkipped);
  const readyForWash = readyForAddons && addonsDone && branchHasWash;
  const servicesChosen =
    stream === 'WASH'
      ? washServiceId !== null
      : readyForAddons && addonsDone && (!branchHasWash || washDone);

  const loadSlots = useCallback(async (): Promise<void> => {
    if (!stream || !locationId || !servicesChosen) {
      return;
    }
    setSlotsLoading(true);
    setSlot(null);
    setSlots(null);
    try {
      const serviceId = stream === 'WASH' ? washServiceId : barberServiceIds[0];
      if (!serviceId) {
        setSlots([]);
        return;
      }
      const query = new URLSearchParams({ locationId, date, serviceId });
      if (stream === 'CUT') {
        const extras = barberServiceIds.slice(1);
        if (extras.length > 0) query.set('extraServiceIds', extras.join(','));
        if (barberId) query.set('barberId', barberId);
      }
      const found = await fetchJson<AvailabilitySlot[]>(`/bookings/availability?${query}`);
      setSlots(
        found.map((entry) => ({
          startsAt: entry.startsAt,
          barberId: entry.barberId,
          barberName: entry.barberName,
          washBayId: entry.resourceId,
          label: `${formatTimeMalta(entry.startsAt)}${entry.barberName ? ` · ${entry.barberName}` : ''}${
            entry.resourceName ? ` · ${entry.resourceName}` : ''
          }`,
        })),
      );
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [stream, locationId, servicesChosen, date, washServiceId, barberServiceIds, barberId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // A wash needs a free bay, which the barber slot search does not look for.
  const [washBayId, setWashBayId] = useState<string | null>(null);
  useEffect(() => {
    if (stream !== 'CUT' || !washServiceId || !locationId || !slot) {
      setWashBayId(null);
      return;
    }
    let cancelled = false;
    fetchJson<AvailabilitySlot[]>(
      `/bookings/availability?locationId=${locationId}&date=${date}&serviceId=${washServiceId}`,
    )
      .then((washSlots) => {
        if (cancelled) return;
        const atSameTime = washSlots.find((entry) => entry.startsAt === slot.startsAt);
        setWashBayId(atSameTime?.resourceId ?? washSlots[0]?.resourceId ?? null);
      })
      .catch(() => {
        if (!cancelled) setWashBayId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [stream, washServiceId, locationId, date, slot]);

  const resetFromBranch = (nextLocationId: string): void => {
    setLocationId(nextLocationId);
    setBarberId(null);
    setBarberChosen(false);
    setHaircutId(null);
    setBeardId(null);
    setBeardSkipped(false);
    setAddonIds([]);
    setAddonsDone(false);
    setWashServiceId(null);
    setWashDone(false);
    setSlot(null);
    setSlots(null);
  };

  const submitBooking = useCallback(async (): Promise<void> => {
    if (!stream || !locationId || !slot) {
      return;
    }
    setPhase('booking');
    setError(null);
    const outcome =
      stream === 'WASH'
        ? await bookSingle({
            locationId,
            serviceId: washServiceId ?? '',
            startsAt: slot.startsAt,
            barberId: null,
            washBayId: slot.washBayId,
            vehicleReg,
          })
        : await bookVisit({
            locationId,
            serviceIds: barberServiceIds,
            startsAt: slot.startsAt,
            barberId: slot.barberId ?? barberId ?? '',
            washServiceId,
            washBayId,
            vehicleReg: washServiceId ? vehicleReg : undefined,
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
  }, [
    stream,
    locationId,
    slot,
    washServiceId,
    washBayId,
    barberServiceIds,
    barberId,
    vehicleReg,
    loadSlots,
  ]);

  if (loadFailed) {
    return (
      <p className="rounded-xl border border-dashed border-white/15 p-8 text-white/50">
        Booking is temporarily unavailable — please try again shortly.
      </p>
    );
  }

  if (phase === 'done' && result && result.status === 'booked') {
    const bookedLocation = locations.find((location) => location.id === locationId);
    const mapQuery = bookedLocation ? `${bookedLocation.name}, ${bookedLocation.address}` : null;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${stepCard} text-center`}>
        <p className="font-script text-4xl text-bronze-light">See you soon!</p>
        <p className="mt-4 text-lg">
          Booked for{' '}
          <span className="font-display text-bronze-light">{formatTimeMalta(result.startsAt)}</span> on{' '}
          {result.startsAt.slice(0, 10)}
        </p>
        <div className="mx-auto mt-4 max-w-sm text-left text-sm text-white/60">
          {chosenServices.map((service) => (
            <div key={service.id} className="flex justify-between border-b border-white/5 py-1.5">
              <span>{service.name}</span>
              <span className="text-white/40">{priceLabel(service)}</span>
            </div>
          ))}
        </div>
        <p className="font-display mt-3 text-4xl text-bronze-light">{formatEuro(result.amountCents)}</p>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/50">
          Payment reference <span className="font-mono text-white/70">{result.paymentReference}</span>. Your
          booking is held as pending and confirms the moment Trust Payments settles the charge.
        </p>
        {bookedLocation && mapQuery ? (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-white/10 bg-graphite-deep/60 p-4">
            <p className="font-medium">{bookedLocation.name}</p>
            <p className="mt-0.5 text-sm text-white/50">{bookedLocation.address}</p>
            <div className="mt-3 flex justify-center gap-3 text-sm">
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(mapQuery)}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/15 px-4 py-1.5 text-white/70 transition hover:text-white"
              >
                Open in Waze
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/15 px-4 py-1.5 text-white/70 transition hover:text-white"
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        ) : null}
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/account"
            className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light"
          >
            My bookings
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-5 py-2.5 text-white/70 transition hover:text-white"
          >
            Home
          </Link>
        </div>
      </motion.div>
    );
  }

  /** Running tally, shown from the haircut card onwards. */
  const summary = (): JSX.Element | null => {
    if (chosenServices.length === 0) return null;
    return (
      <p className="mt-4 text-xs text-white/45">
        {chosenServices.map((service) => service.name).join(' + ')} ·{' '}
        <span className="text-bronze-light">
          {hasQuoteOnly && totalCents === 0 ? 'On inspection' : formatEuro(totalCents)}
          {hasQuoteOnly && totalCents > 0 ? ' + quote' : ''}
        </span>
      </p>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1 — what */}
      <div className={stepCard}>
        <h2 className="text-2xl">What are you booking?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: 'CUT', mark: 'The Barber', title: 'A Cut', copy: 'Haircuts, beards and finishing touches.', accent: KIND_COLORS.BARBER },
              { key: 'WASH', mark: 'The Car Wash', title: 'A Wash', copy: 'Washes, valeting and detailing for your car.', accent: KIND_COLORS.WASH },
            ] as const
          ).map((candidate) => (
            <button
              key={candidate.key}
              type="button"
              onClick={() => {
                setStream(candidate.key);
                resetFromBranch('');
                setLocationId(null);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                stream === candidate.key ? 'border-white/40' : 'border-white/10 hover:border-white/25'
              }`}
              style={{ background: candidate.accent.soft }}
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

      {/* 2 — where, as branch cards behind their shopfront */}
      {stream ? (
        <div className={stepCard}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl">Which branch?</h2>
            {geoStatus === 'idle' || geoStatus === 'asking' ? (
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoStatus === 'asking'}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/60 transition hover:text-white disabled:opacity-50"
              >
                {geoStatus === 'asking' ? 'Locating…' : '📍 Use my location'}
              </button>
            ) : geoStatus === 'granted' ? (
              <span className="text-xs text-white/40">Sorted by distance to you</span>
            ) : (
              <span className="text-xs text-white/40">Location unavailable — showing all branches</span>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {branches.map((location) => {
              const dist =
                coords && location.latitude !== null && location.longitude !== null
                  ? distanceKm(coords, { lat: location.latitude, lng: location.longitude })
                  : null;
              const active = locationId === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => resetFromBranch(location.id)}
                  aria-pressed={active}
                  className={`group relative flex min-h-[132px] flex-col justify-end overflow-hidden rounded-xl border p-4 text-left transition ${
                    active ? 'border-bronze' : 'border-white/10 hover:border-white/30'
                  }`}
                  style={
                    location.photoUrl
                      ? {
                          backgroundImage: `linear-gradient(to top, rgba(14,14,16,0.92), rgba(14,14,16,0.35)), url(${location.photoUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : { background: 'linear-gradient(to top, rgba(14,14,16,0.92), rgba(176,141,87,0.18))' }
                  }
                >
                  <span className="relative z-10">
                    <span className="block text-lg font-medium">{location.name}</span>
                    <span className="mt-0.5 block text-xs text-white/55">{location.address}</span>
                    <span className="mt-1 block text-xs text-white/40">
                      {dist !== null ? `${dist.toFixed(1)} km away` : ''}
                      {dist !== null && location.bayCount > 0 ? ' · ' : ''}
                      {location.bayCount > 0 ? 'Car wash on site' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {stream === 'WASH' && branches.length < locations.length ? (
            <p className="mt-3 text-xs text-white/40">Showing branches with wash bays.</p>
          ) : null}
        </div>
      ) : null}

      {/* 3 — who (barber comes before the services) */}
      {stream === 'CUT' && locationId ? (
        <div className={stepCard}>
          <h2 className="text-2xl">Who&rsquo;s cutting?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setBarberId(null);
                setBarberChosen(true);
              }}
              className={chip(barberChosen && barberId === null)}
            >
              Any barber
            </button>
            {barbers.map((barber) => {
              const rating = ratings[barber.id];
              return (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => {
                    setBarberId(barber.id);
                    setBarberChosen(true);
                  }}
                  className={chip(barberId === barber.id)}
                >
                  {barber.firstName} {barber.lastName}
                  {rating?.average !== null && rating?.average !== undefined ? (
                    <span className="ml-1.5 text-white/40">
                      ★ {rating.average} ({rating.count})
                    </span>
                  ) : null}
                  {barber.stationNo !== null ? (
                    <span className="ml-1.5 text-white/30">#{barber.stationNo}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 4 — haircut */}
      {stream === 'CUT' && locationId && barberChosen ? (
        <div className={stepCard}>
          <h2 className="text-2xl">Haircuts</h2>
          <p className="mt-1 text-sm text-white/45">Combos first — pick the cut you&rsquo;re after.</p>
          <div className="mt-4 flex flex-col gap-2">
            {haircuts.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                selected={haircutId === service.id}
                onSelect={() => {
                  setHaircutId(service.id);
                  setSlot(null);
                }}
              />
            ))}
          </div>
          {summary()}
        </div>
      ) : null}

      {/* 5 — beard */}
      {readyForBeard ? (
        <div className={stepCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">Beards</h2>
            <button
              type="button"
              onClick={() => {
                setBeardId(null);
                setBeardSkipped(true);
                setSlot(null);
              }}
              className={chip(beardSkipped && beardId === null)}
            >
              Skip
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {beards.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                selected={beardId === service.id}
                onSelect={() => {
                  setBeardId(service.id);
                  setBeardSkipped(false);
                  setSlot(null);
                }}
              />
            ))}
          </div>
          {summary()}
        </div>
      ) : null}

      {/* 6 — add-ons (several allowed) */}
      {readyForAddons ? (
        <div className={stepCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">Add-ons</h2>
            <button
              type="button"
              onClick={() => {
                setAddonsDone(true);
                setSlot(null);
              }}
              className={chip(addonsDone)}
            >
              {addonIds.length > 0 ? 'Done' : 'Skip'}
            </button>
          </div>
          <p className="mt-1 text-sm text-white/45">Pick as many as you like.</p>
          <div className="mt-4 flex flex-col gap-2">
            {addons.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                selected={addonIds.includes(service.id)}
                onSelect={() => {
                  setAddonIds((prev) =>
                    prev.includes(service.id)
                      ? prev.filter((id) => id !== service.id)
                      : [...prev, service.id],
                  );
                  setSlot(null);
                }}
              />
            ))}
          </div>
          {summary()}
        </div>
      ) : null}

      {/* 7 — car wash, only where there are bays */}
      {readyForWash ? (
        <div className={stepCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">Car wash</h2>
            <button
              type="button"
              onClick={() => {
                setWashServiceId(null);
                setWashDone(true);
                setSlot(null);
              }}
              className={chip(washDone && washServiceId === null)}
            >
              Skip
            </button>
          </div>
          <p className="mt-1 text-sm text-white/45">
            {branch?.name} only — your car is washed while you&rsquo;re in the chair.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {washes.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                selected={washServiceId === service.id}
                onSelect={() => {
                  setWashServiceId(service.id);
                  setWashDone(true);
                  setSlot(null);
                }}
              />
            ))}
          </div>
          {summary()}
        </div>
      ) : null}

      {/* wash-only journey keeps its single service list */}
      {stream === 'WASH' && locationId ? (
        <div className={stepCard}>
          <h2 className="text-2xl">Pick a service</h2>
          <div className="mt-4 flex flex-col gap-2">
            {washes.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                selected={washServiceId === service.id}
                onSelect={() => {
                  setWashServiceId(service.id);
                  setSlot(null);
                }}
              />
            ))}
          </div>
          {summary()}
        </div>
      ) : null}

      {/* 8 — when */}
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
              <p className="text-sm text-white/50">Nothing free that day — try another date or branch.</p>
            ) : slots ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((candidate) => {
                  const accent = stream === 'WASH' ? KIND_COLORS.WASH : KIND_COLORS.BARBER;
                  const picked = slot?.startsAt === candidate.startsAt;
                  return (
                    <button
                      key={`${candidate.startsAt}-${candidate.barberId ?? candidate.washBayId ?? ''}`}
                      type="button"
                      onClick={() => setSlot(candidate)}
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        picked ? 'text-graphite-deep' : 'text-white/80 hover:text-white'
                      }`}
                      style={{
                        background: picked ? accent.solid : accent.soft,
                        boxShadow: `inset 0 0 0 1px ${accent.solid}33`,
                      }}
                    >
                      {candidate.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 9 — confirm */}
      <AnimatePresence>
        {stream && locationId && servicesChosen && slot ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={stepCard}
          >
            <h2 className="text-2xl">Confirm</h2>
            <div className="mt-4 flex flex-col gap-1.5 text-sm">
              {chosenServices.map((service) => (
                <div key={service.id} className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-white/70">{service.name}</span>
                  <span className="text-white/50">{priceLabel(service)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-white/70">
              {formatTimeMalta(slot.startsAt)} on {date} · {branch?.name}
              {slot.barberName ? ` · with ${slot.barberName}` : ''}
            </p>
            <p className="font-display mt-2 text-4xl text-bronze-light">
              {hasQuoteOnly && totalCents === 0 ? 'On inspection' : formatEuro(totalCents)}
              {hasQuoteOnly && totalCents > 0 ? ' + quote' : ''}
            </p>
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
                <p className="mb-4 text-sm text-white/60">Sign in or create an account to lock in your slot.</p>
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
