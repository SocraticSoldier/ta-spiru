'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  AvailabilitySlot,
  BarberSummary,
  LocationSummary,
  ServiceSummary,
  VehicleSizeName,
} from '@ta-spiru/shared';
import {
  VEHICLE_SIZE_LABELS,
  vehicleMakes,
  vehicleModels,
  vehicleSizeFor,
} from '@ta-spiru/shared';

import { bookSingle, bookVisit, saveVehicle, type BookingActionResult } from '@/app/book/actions';
import { AuthForm } from '@/components/auth-form';
import {
  ContinueButton,
  OptionCard,
  OptionRow,
  SkipButton,
  StepScreen,
} from '@/components/flow/step-screen';
import { formatEuro } from '@/lib/format';
import { formatTimeMalta, shiftDate, todayMalta } from '@/lib/time';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** A service as the chosen barber charges it — GET /barbers/:id/services. */
interface BarberServicePrice {
  serviceId: string;
  priceCents: number;
  durationMin: number;
}

/** A car already on the account — GET /account/vehicles. */
interface VehicleRow {
  id: string;
  reg: string;
  make: string;
  model: string;
  size: VehicleSizeName;
}

/** A family member on the account, as GET /account/members returns them. */
interface MemberRow {
  id: string;
  name: string;
  birthYear: number | null;
}

/**
 * The customer booking journey, one decision per screen:
 *
 *   branch → barber → haircut → beard → extras → car wash (Fgura only)
 *          → day & time → who it's for → confirm
 *
 * The car wash screen only exists at branches with bays, so the total step
 * count changes once a branch is picked — that is deliberate, and honest.
 */
type StepKey =
  | 'branch'
  | 'barber'
  | 'haircut'
  | 'beard'
  | 'extras'
  | 'wash'
  | 'vehicle'
  | 'when'
  | 'who'
  | 'confirm';

interface Coords {
  lat: number;
  lng: number;
}

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

const fetchJson = async <T,>(path: string, withCredentials = false): Promise<T> => {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    cache: 'no-store',
    ...(withCredentials ? { credentials: 'include' as const } : {}),
  });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as T;
};

const priceLabel = (service: ServiceSummary, cents: number): string =>
  service.isQuoteOnly ? 'On inspection' : formatEuro(cents);

export const BookingFlow = ({ stream }: { stream: 'CUT' | 'WASH' }): JSX.Element => {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberSummary[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  // Prices follow the barber's seniority, and the barber is picked before the
  // services — so once one is chosen, quote their prices, not the base ones.
  const [barberPrices, setBarberPrices] = useState<Map<string, BarberServicePrice>>(new Map());
  const [haircutId, setHaircutId] = useState<string | null>(null);
  const [beardId, setBeardId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [washServiceIds, setWashServiceIds] = useState<string[]>([]);
  // Make and model decide the wash size band, so the customer never has to
  // judge whether their own car counts as "medium".
  const [vehicleMake, setVehicleMake] = useState<string | null>(null);
  const [vehicleModel, setVehicleModel] = useState<string | null>(null);
  const [saveVehicle_, setSaveVehicle] = useState(true);
  const [washBayId, setWashBayId] = useState<string | null>(null);

  const [date, setDate] = useState<string>(shiftDate(todayMalta(), 1));
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [savedVehicles, setSavedVehicles] = useState<VehicleRow[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [vehicleReg, setVehicleReg] = useState('');

  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<'form' | 'auth' | 'booking' | 'done'>('form');
  const [result, setResult] = useState<BookingActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    Promise.all([
      fetchJson<LocationSummary[]>('/locations'),
      fetchJson<ServiceSummary[]>('/services'),
    ])
      .then(([l, s]) => {
        setLocations(l);
        setServices(s);
      })
      .catch(() => setLoadFailed(true));
    // Members only exist for a signed-in customer; absence is fine.
    fetchJson<MemberRow[]>('/account/members', true)
      .then(setMembers)
      .catch(() => setMembers([]));
    fetchJson<VehicleRow[]>('/account/vehicles', true)
      .then(setSavedVehicles)
      .catch(() => setSavedVehicles([]));
  }, []);

  useEffect(() => {
    if (!locationId || stream !== 'CUT') return;
    fetchJson<BarberSummary[]>(`/barbers?locationId=${locationId}`)
      .then(setBarbers)
      .catch(() => setBarbers([]));
  }, [locationId, stream]);

  useEffect(() => {
    if (!barberId) {
      setBarberPrices(new Map());
      return;
    }
    let cancelled = false;
    fetchJson<BarberServicePrice[]>(`/barbers/${barberId}/services`)
      .then((rows) => {
        if (!cancelled) setBarberPrices(new Map(rows.map((r) => [r.serviceId, r])));
      })
      .catch(() => {
        if (!cancelled) setBarberPrices(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [barberId]);

  /** What this service costs for the barber in hand, falling back to the menu. */
  const priceOf = useCallback(
    (service: ServiceSummary): number => barberPrices.get(service.id)?.priceCents ?? service.priceCents,
    [barberPrices],
  );
  const minutesOf = useCallback(
    (service: ServiceSummary): number => barberPrices.get(service.id)?.durationMin ?? service.durationMin,
    [barberPrices],
  );

  const branch = locations.find((l) => l.id === locationId) ?? null;
  const branchHasWash = (branch?.bayCount ?? 0) > 0;

  const steps = useMemo((): StepKey[] => {
    if (stream === 'WASH') return ['branch', 'haircut', 'vehicle', 'when', 'who', 'confirm'];
    const base: StepKey[] = ['branch', 'barber', 'haircut', 'beard', 'extras'];
    // The car comes first: wash prices are banded by size, and the menu lists a
    // separate row per band. Without knowing the car we would be offering the
    // same wash three times and letting someone pick the wrong one.
    if (branchHasWash) base.push('vehicle');
    if (branchHasWash && vehicleModel) base.push('wash');
    return [...base, 'when', 'who', 'confirm'];
  }, [stream, branchHasWash, vehicleModel]);

  const current = steps[Math.min(cursor, steps.length - 1)] ?? 'branch';
  const next = (): void => setCursor((c) => Math.min(c + 1, steps.length - 1));
  const back = (): void => setCursor((c) => Math.max(c - 1, 0));

  const inCategory = (category: ServiceSummary['category']): ServiceSummary[] =>
    services.filter((s) => s.category === category);
  const haircuts = stream === 'WASH' ? inCategory('WASH') : inCategory('HAIRCUT');
  const beards = inCategory('BEARD');
  const addons = inCategory('ADDON');
  const derivedSize: VehicleSizeName =
    vehicleMake && vehicleModel ? vehicleSizeFor(vehicleMake, vehicleModel) : 'MEDIUM';

  const allWashes = inCategory('WASH');
  /**
   * The menu carries one row per size band — "Exterior Wash (Small/Medium/
   * Large)". Show only the band this car falls in, plus the flat-priced
   * detailing that has no bands at all.
   */
  const SIZE_SUFFIX: Readonly<Record<VehicleSizeName, RegExp>> = {
    SMALL: /\(Small\)$/,
    MEDIUM: /\(Medium\)$/,
    LARGE: /\(Large \/ SUV\)$/,
  };
  const isSizedWash = (name: string): boolean =>
    /\((Small|Medium|Large \/ SUV)\)$/.test(name);
  const washes = allWashes.filter(
    (w) => !isSizedWash(w.name) || SIZE_SUFFIX[derivedSize].test(w.name),
  );

  const branches = (
    stream === 'WASH' ? locations.filter((l) => l.bayCount > 0) : locations
  ).slice();
  if (coords) {
    branches.sort((a, b) => {
      const d = (l: LocationSummary): number =>
        l.latitude !== null && l.longitude !== null
          ? distanceKm(coords, { lat: l.latitude, lng: l.longitude })
          : Infinity;
      return d(a) - d(b);
    });
  }

  const barberServiceIds = useMemo(
    () => [haircutId, beardId, ...addonIds].filter((id): id is string => Boolean(id)),
    [haircutId, beardId, addonIds],
  );

  const chosen = useMemo((): ServiceSummary[] => {
    const ids = stream === 'WASH' ? [haircutId] : [...barberServiceIds, ...washServiceIds];
    return ids
      .filter((id): id is string => Boolean(id))
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is ServiceSummary => Boolean(s));
  }, [stream, haircutId, barberServiceIds, washServiceIds, services]);

  const totalCents = chosen.reduce((sum, s) => sum + priceOf(s), 0);
  const hasQuote = chosen.some((s) => s.isQuoteOnly);
  const dates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => shiftDate(todayMalta(), i + 1)),
    [],
  );

  // Slots are only fetched once the visit length is known.
  useEffect(() => {
    if (current !== 'when' || !locationId) return;
    const first = stream === 'WASH' ? haircutId : barberServiceIds[0];
    if (!first) return;
    setSlotsLoading(true);
    setSlot(null);
    const query = new URLSearchParams({ locationId, date, serviceId: first });
    if (stream === 'CUT') {
      const extras = barberServiceIds.slice(1);
      if (extras.length) query.set('extraServiceIds', extras.join(','));
      if (barberId) query.set('barberId', barberId);
    }
    fetchJson<AvailabilitySlot[]>(`/bookings/availability?${query}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [current, locationId, date, stream, haircutId, barberServiceIds, barberId]);

  // A wash alongside a cut needs a free bay at the same moment.
  useEffect(() => {
    const firstWash = washServiceIds[0];
    if (!firstWash || !locationId || !slot) {
      setWashBayId(null);
      return;
    }
    fetchJson<AvailabilitySlot[]>(
      `/bookings/availability?locationId=${locationId}&date=${date}&serviceId=${firstWash}`,
    )
      .then((ws) => {
        const same = ws.find((w) => w.startsAt === slot.startsAt);
        setWashBayId(same?.resourceId ?? ws[0]?.resourceId ?? null);
      })
      .catch(() => setWashBayId(null));
  }, [washServiceIds, locationId, date, slot]);

  const submit = useCallback(async (): Promise<void> => {
    if (!locationId || !slot) return;
    setPhase('booking');
    setError(null);
    const outcome =
      stream === 'WASH'
        ? await bookSingle({
            locationId,
            serviceId: haircutId ?? '',
            startsAt: slot.startsAt,
            barberId: null,
            washBayId: slot.resourceId,
            vehicleReg,
          })
        : await bookVisit({
            locationId,
            serviceIds: barberServiceIds,
            startsAt: slot.startsAt,
            barberId: slot.barberId ?? barberId ?? '',
            washServiceIds,
            washBayId,
            vehicleReg: washServiceIds.length ? vehicleReg : undefined,
            memberId,
          });
    if (outcome.status === 'auth-required') return setPhase('auth');
    if (outcome.status === 'error') {
      setPhase('form');
      setError(outcome.message);
      return;
    }
    // The car is only worth keeping once the booking actually landed.
    if (saveVehicle_ && vehicleMake && vehicleModel && vehicleReg.trim()) {
      void saveVehicle({ reg: vehicleReg.trim(), make: vehicleMake, model: vehicleModel });
    }
    setResult(outcome);
    setPhase('done');
  }, [
    locationId,
    slot,
    stream,
    haircutId,
    barberServiceIds,
    barberId,
    washServiceIds,
    washBayId,
    vehicleReg,
    memberId,
    saveVehicle_,
    vehicleMake,
    vehicleModel,
  ]);

  if (loadFailed) {
    return (
      <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/50">
        Booking is temporarily unavailable — please try again shortly.
      </p>
    );
  }

  if (phase === 'done' && result?.status === 'booked') {
    const mapQuery = branch ? `${branch.name}, ${branch.address}` : null;
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="font-script text-4xl text-bronze-light">See you soon!</p>
        <p className="mt-4 text-lg">
          {formatTimeMalta(result.startsAt)} on {result.startsAt.slice(0, 10)}
        </p>
        <div className="mt-6 flex flex-col gap-1.5 text-left text-sm">
          {chosen.map((s) => (
            <div key={s.id} className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/70">{s.name}</span>
              <span className="text-white/45">{priceLabel(s, priceOf(s))}</span>
            </div>
          ))}
        </div>
        <p className="font-display mt-4 text-4xl text-bronze-light">{formatEuro(result.amountCents)}</p>
        <p className="mt-3 text-sm text-white/50">
          Reference <span className="font-mono text-white/70">{result.paymentReference}</span>
        </p>
        {branch && mapQuery ? (
          <div className="mt-6 rounded-xl border border-white/10 p-4">
            <p className="font-medium">{branch.name}</p>
            <p className="mt-0.5 text-sm text-white/50">{branch.address}</p>
            <div className="mt-3 flex justify-center gap-3 text-sm">
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(mapQuery)}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/15 px-4 py-1.5 text-white/70"
              >
                Waze
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/15 px-4 py-1.5 text-white/70"
              >
                Google Maps
              </a>
            </div>
          </div>
        ) : null}
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/account" className="rounded-xl bg-bronze px-5 py-2.5 font-medium text-graphite-deep">
            My bookings
          </Link>
          <Link href="/" className="rounded-xl border border-white/15 px-5 py-2.5 text-white/70">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const stepNo = cursor + 1;
  const total = steps.length;
  const runningTotal =
    chosen.length > 0
      ? `${chosen.length} selected · ${hasQuote && totalCents === 0 ? 'On inspection' : formatEuro(totalCents)}`
      : undefined;

  return (
    <AnimatePresence mode="wait">
      {current === 'branch' ? (
        <StepScreen
          key="branch"
          step={stepNo}
          total={total}
          title="Which branch?"
          subtitle={geoStatus === 'granted' ? 'Closest to you first' : undefined}
          footer={
            geoStatus === 'idle' ? (
              <SkipButton
                label="📍 Use my location"
                onClick={() => {
                  if (!('geolocation' in navigator)) return setGeoStatus('denied');
                  setGeoStatus('asking');
                  navigator.geolocation.getCurrentPosition(
                    (p) => {
                      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
                      setGeoStatus('granted');
                    },
                    () => setGeoStatus('denied'),
                    { timeout: 8000 },
                  );
                }}
              />
            ) : undefined
          }
        >
          <div className="grid gap-3">
            {branches.map((l) => {
              const dist =
                coords && l.latitude !== null && l.longitude !== null
                  ? distanceKm(coords, { lat: l.latitude, lng: l.longitude })
                  : null;
              return (
                <OptionCard
                  key={l.id}
                  title={l.name}
                  subtitle={l.address}
                  note={[dist !== null ? `${dist.toFixed(1)} km away` : '', l.bayCount > 0 ? 'Car wash on site' : '']
                    .filter(Boolean)
                    .join(' · ')}
                  imageUrl={l.photoUrl}
                  selected={locationId === l.id}
                  onSelect={() => {
                    // Everything after this screen was chosen for the old
                    // branch — its barbers, its menu, its wash bays. Switching
                    // to Naxxar with a Fgura car wash still on the bill would
                    // quote a price the branch cannot honour.
                    if (l.id !== locationId) {
                      setBarberId(null);
                      setHaircutId(null);
                      setBeardId(null);
                      setAddonIds([]);
                      setWashServiceIds([]);
                      setVehicleMake(null);
                      setVehicleModel(null);
                      setWashBayId(null);
                      setSlot(null);
                      setSlots(null);
                    }
                    setLocationId(l.id);
                    next();
                  }}
                />
              );
            })}
          </div>
        </StepScreen>
      ) : null}

      {current === 'barber' ? (
        <StepScreen key="barber" step={stepNo} total={total} title="Who's cutting?" onBack={back}>
          <div className="flex flex-col gap-2">
            <OptionRow
              title="Any barber"
              meta="Whoever is free at the time you want"
              selected={barberId === null}
              onSelect={() => {
                if (barberId !== null) setSlot(null);
                setBarberId(null);
                next();
              }}
            />
            {barbers.map((b) => (
              <OptionRow
                key={b.id}
                title={`${b.firstName} ${b.lastName}`}
                meta={[b.seniority ? b.seniority.toLowerCase() : '', b.stationNo ? `station ${b.stationNo}` : '']
                  .filter(Boolean)
                  .join(' · ')}
                selected={barberId === b.id}
                onSelect={() => {
                  if (b.id !== barberId) setSlot(null);
                  setBarberId(b.id);
                  next();
                }}
              />
            ))}
          </div>
        </StepScreen>
      ) : null}

      {current === 'haircut' ? (
        <StepScreen
          key="haircut"
          step={stepNo}
          total={total}
          title={stream === 'WASH' ? 'Which wash?' : 'Haircuts'}
          subtitle={stream === 'WASH' ? undefined : 'Combos first'}
          onBack={back}
        >
          <div className="flex flex-col gap-2">
            {haircuts.map((s) => (
              <OptionRow
                key={s.id}
                title={s.name}
                meta={`${minutesOf(s)} min${s.isComboEligible ? ' · Combo' : ''}`}
                trailing={priceLabel(s, priceOf(s))}
                selected={haircutId === s.id}
                onSelect={() => {
                  setHaircutId(s.id);
                  next();
                }}
              />
            ))}
          </div>
        </StepScreen>
      ) : null}

      {current === 'beard' ? (
        <StepScreen
          key="beard"
          step={stepNo}
          total={total}
          title="Beards"
          subtitle={runningTotal}
          onBack={back}
          footer={<SkipButton label="No beard service" onClick={() => { setBeardId(null); next(); }} />}
        >
          <div className="flex flex-col gap-2">
            {beards.map((s) => (
              <OptionRow
                key={s.id}
                title={s.name}
                meta={`${minutesOf(s)} min`}
                trailing={priceLabel(s, priceOf(s))}
                selected={beardId === s.id}
                onSelect={() => {
                  setBeardId(s.id);
                  next();
                }}
              />
            ))}
          </div>
        </StepScreen>
      ) : null}

      {current === 'extras' ? (
        <StepScreen
          key="extras"
          step={stepNo}
          total={total}
          title="Extras"
          subtitle="Pick as many as you like"
          onBack={back}
          footer={
            <ContinueButton
              label={addonIds.length > 0 ? `Continue with ${addonIds.length}` : 'No extras'}
              onClick={next}
            />
          }
        >
          <div className="flex flex-col gap-2">
            {addons.map((s) => (
              <OptionRow
                key={s.id}
                title={s.name}
                meta={`${minutesOf(s)} min`}
                trailing={priceLabel(s, priceOf(s))}
                selected={addonIds.includes(s.id)}
                onSelect={() =>
                  setAddonIds((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                  )
                }
              />
            ))}
          </div>
        </StepScreen>
      ) : null}

      {current === 'wash' ? (
        <StepScreen
          key="wash"
          step={stepNo}
          total={total}
          title="Add a car wash?"
          subtitle={`${branch?.name} only — washed while you're in the chair`}
          onBack={back}
          footer={
            washServiceIds.length > 0 ? (
              <ContinueButton label={`Continue with ${washServiceIds.length}`} onClick={next} />
            ) : (
              <SkipButton label="No car wash" onClick={() => { setWashServiceIds([]); next(); }} />
            )
          }
        >
          <div className="flex flex-col gap-2">
            {washes.map((s) => (
              <OptionRow
                key={s.id}
                title={s.name}
                meta={`${minutesOf(s)} min`}
                trailing={priceLabel(s, priceOf(s))}
                selected={washServiceIds.includes(s.id)}
                onSelect={() => {
                  // Several can be stacked — a wash plus a wax, say — and they
                  // run one after another on the bay.
                  setWashServiceIds((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                  );
                  setSlot(null);
                }}
              />
            ))}
          </div>
        </StepScreen>
      ) : null}

      {current === 'vehicle' ? (
        <StepScreen
          key="vehicle"
          step={stepNo}
          total={total}
          title={stream === 'WASH' ? 'Which car?' : 'Add a car wash?'}
          subtitle="Pick the car and we'll price the wash for its size"
          onBack={back}
          footer={
            <>
              <ContinueButton
                label={vehicleModel ? `Continue · ${VEHICLE_SIZE_LABELS[derivedSize]}` : 'Pick a model'}
                disabled={!vehicleModel}
                onClick={next}
              />
              {vehicleModel ? (
                <label className="mt-3 flex items-center justify-center gap-2 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={saveVehicle_}
                    onChange={(e) => setSaveVehicle(e.target.checked)}
                  />
                  Save this car to my account
                </label>
              ) : (
                <SkipButton
                  label="No car wash, thanks"
                  onClick={() => {
                    setVehicleMake(null);
                    setVehicleModel(null);
                    setWashServiceIds([]);
                    next();
                  }}
                />
              )}
            </>
          }
        >
          {savedVehicles.length > 0 && !vehicleMake ? (
            <div className="mb-5">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Your cars</p>
              <div className="flex flex-col gap-2">
                {savedVehicles.map((v) => (
                  <OptionRow
                    key={v.id}
                    title={`${v.make} ${v.model}`}
                    meta={`${v.reg} · ${VEHICLE_SIZE_LABELS[v.size]}`}
                    selected={false}
                    onSelect={() => {
                      setVehicleMake(v.make);
                      setVehicleModel(v.model);
                      setVehicleReg(v.reg);
                      setSaveVehicle(false);
                      next();
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">
            {vehicleMake ? 'Model' : 'Make'}
          </p>
          <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
            {!vehicleMake
              ? vehicleMakes().map((make) => (
                  <OptionRow
                    key={make}
                    title={make}
                    selected={false}
                    onSelect={() => {
                      setVehicleMake(make);
                      setVehicleModel(null);
                    }}
                  />
                ))
              : vehicleModels(vehicleMake).map((m) => (
                  <OptionRow
                    key={m.model}
                    title={m.model}
                    meta={VEHICLE_SIZE_LABELS[m.size]}
                    selected={vehicleModel === m.model}
                    onSelect={() => setVehicleModel(m.model)}
                  />
                ))}
          </div>
          {vehicleMake ? (
            <button
              type="button"
              onClick={() => {
                setVehicleMake(null);
                setVehicleModel(null);
              }}
              className="mt-3 text-xs text-white/40 underline transition hover:text-white"
            >
              ← Different make
            </button>
          ) : null}

          <input
            aria-label="Vehicle registration"
            placeholder="Registration (e.g. ABC 123)"
            value={vehicleReg}
            onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
            maxLength={12}
            className="mt-4 w-full rounded-xl border border-white/10 bg-graphite-deep px-4 py-3 text-white outline-none focus:border-bronze"
          />
        </StepScreen>
      ) : null}

      {current === 'when' ? (
        <StepScreen
          key="when"
          step={stepNo}
          total={total}
          title="Day & time"
          subtitle={runningTotal}
          onBack={back}
          footer={slot ? <ContinueButton onClick={next} /> : undefined}
        >
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm transition ${
                  date === d ? 'bg-bronze text-graphite-deep' : 'border border-white/10 text-white/60'
                }`}
              >
                {d.slice(5)}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {slotsLoading ? (
              <p className="text-sm text-white/50">Finding free times…</p>
            ) : slots && slots.length === 0 ? (
              <p className="text-sm text-white/50">Nothing free that day — try another.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(slots ?? []).map((s) => (
                  <button
                    key={`${s.startsAt}-${s.barberId ?? s.resourceId ?? ''}`}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`rounded-xl py-3 text-sm transition ${
                      slot?.startsAt === s.startsAt
                        ? 'bg-bronze text-graphite-deep'
                        : 'border border-white/10 text-white/75 hover:border-white/30'
                    }`}
                  >
                    {formatTimeMalta(s.startsAt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </StepScreen>
      ) : null}

      {current === 'who' ? (
        <StepScreen
          key="who"
          step={stepNo}
          total={total}
          title="Who's this for?"
          subtitle="Points always stay on your account"
          onBack={back}
        >
          <div className="flex flex-col gap-2">
            <OptionRow
              title="Me"
              selected={memberId === null}
              onSelect={() => {
                setMemberId(null);
                next();
              }}
            />
            {members.map((m) => (
              <OptionRow
                key={m.id}
                title={m.name}
                meta={m.birthYear ? `born ${m.birthYear}` : undefined}
                selected={memberId === m.id}
                onSelect={() => {
                  setMemberId(m.id);
                  next();
                }}
              />
            ))}
            <Link
              href="/account"
              className="mt-1 rounded-xl border border-dashed border-white/15 px-4 py-3.5 text-center text-sm text-white/50 transition hover:text-white"
            >
              + Add a family member
            </Link>
          </div>
        </StepScreen>
      ) : null}

      {current === 'confirm' ? (
        <StepScreen
          key="confirm"
          step={stepNo}
          total={total}
          title="Confirm your booking"
          onBack={back}
          footer={
            phase === 'auth' ? undefined : (
              <ContinueButton
                label={phase === 'booking' ? 'Booking…' : !slot ? 'Pick a time first' : 'Confirm booking'}
                disabled={phase === 'booking' || !slot}
                onClick={() => void submit()}
              />
            )
          }
        >
          <div className="flex flex-col gap-1.5 text-sm">
            {chosen.map((s) => (
              <div key={s.id} className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-white/70">{s.name}</span>
                <span className="text-white/45">{priceLabel(s, priceOf(s))}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-white/70">
            {slot ? formatTimeMalta(slot.startsAt) : ''} on {date} · {branch?.name}
            {slot?.barberName ? ` · ${slot.barberName}` : ''}
          </p>
          {memberId ? (
            <p className="mt-1 text-sm text-bronze-light">
              For {members.find((m) => m.id === memberId)?.name}
            </p>
          ) : null}
          <p className="font-display mt-3 text-4xl text-bronze-light">
            {hasQuote && totalCents === 0 ? 'On inspection' : formatEuro(totalCents)}
          </p>
          {washServiceIds.length > 0 || stream === 'WASH' ? (
            <input
              aria-label="Vehicle registration"
              placeholder="Vehicle registration"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value)}
              maxLength={16}
              className="mt-4 w-full rounded-xl border border-white/10 bg-graphite-deep px-4 py-3 text-white outline-none focus:border-bronze"
            />
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          {phase === 'auth' ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-graphite-deep/60 p-5">
              <p className="mb-4 text-sm text-white/60">Sign in to lock in your slot.</p>
              <AuthForm onSuccess={() => void submit()} />
            </div>
          ) : null}
        </StepScreen>
      ) : null}
    </AnimatePresence>
  );
};
