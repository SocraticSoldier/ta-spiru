import type { JSX } from 'react';
import {
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_ORDER,
  type ServiceCategoryName,
  type ServiceSummary,
} from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { formatEuro } from '@/lib/format';
import { moveService, recategoriseService, retireService, updateService } from './actions';

const CARD_BLURB: Readonly<Record<ServiceCategoryName, string>> = {
  HAIRCUT: 'The first card a customer sees. Combos sit at the top.',
  BEARD: 'Offered after the haircut — the customer can skip this card.',
  ADDON: 'Offered last, and the customer can pick several.',
  WASH: 'Only shown at branches with wash bays (Fgura).',
};

const input =
  'rounded-lg border border-white/10 bg-graphite-deep px-2.5 py-1.5 text-sm text-white outline-none focus:border-bronze';

const ServiceRow = ({
  service,
  first,
  last,
}: {
  service: ServiceSummary;
  first: boolean;
  last: boolean;
}): JSX.Element => (
  <div className="rounded-xl border border-white/10 bg-graphite px-4 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <form action={moveService}>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="direction" value="up" />
          <button
            type="submit"
            disabled={first}
            aria-label={`Move ${service.name} up`}
            className="rounded border border-white/15 px-1.5 text-xs leading-4 text-white/60 transition hover:text-white disabled:opacity-25"
          >
            ▲
          </button>
        </form>
        <form action={moveService}>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="direction" value="down" />
          <button
            type="submit"
            disabled={last}
            aria-label={`Move ${service.name} down`}
            className="rounded border border-white/15 px-1.5 text-xs leading-4 text-white/60 transition hover:text-white disabled:opacity-25"
          >
            ▼
          </button>
        </form>
      </div>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{service.name}</span>
        <span className="text-xs text-white/40">
          {service.durationMin} min · {service.isQuoteOnly ? 'On inspection' : formatEuro(service.priceCents)}
          {service.isComboEligible ? ' · Combo' : ''}
          {service.tiers.length > 0
            ? ` · ${service.tiers.map((tier) => `${tier.seniority[0]}${formatEuro(tier.priceCents)}`).join(' ')}`
            : ''}
        </span>
      </span>

      <form action={recategoriseService} className="flex items-center gap-1.5">
        <input type="hidden" name="id" value={service.id} />
        <select name="category" defaultValue={service.category} className={input} aria-label={`Card for ${service.name}`}>
          {SERVICE_CATEGORY_ORDER.map((category) => (
            <option key={category} value={category}>
              {SERVICE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/60 transition hover:text-white">
          Move card
        </button>
      </form>
    </div>

    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-white/40 transition hover:text-white/70">Edit</summary>
      <form action={updateService} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={service.id} />
        <label className="flex flex-col gap-1 text-xs text-white/50">
          Name
          <input name="name" defaultValue={service.name} required className={`${input} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          Price (€)
          <input
            name="priceEuro"
            type="number"
            step="0.01"
            min={0}
            defaultValue={(service.priceCents / 100).toFixed(2)}
            required
            className={`${input} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          Minutes
          <input
            name="durationMin"
            type="number"
            min={1}
            defaultValue={service.durationMin}
            required
            className={`${input} w-20`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          Description
          <input name="description" defaultValue={service.description ?? ''} className={`${input} w-64`} />
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-white/50">
          <input type="checkbox" name="isComboEligible" defaultChecked={service.isComboEligible} />
          Combo
        </label>
        <button
          type="submit"
          className="rounded-lg bg-bronze px-4 py-1.5 text-sm font-medium text-graphite-deep transition hover:bg-bronze-light"
        >
          Save
        </button>
      </form>
      <form action={retireService} className="mt-2">
        <input type="hidden" name="id" value={service.id} />
        <button type="submit" className="text-xs text-red-400/70 transition hover:text-red-400">
          Take off the booking screen
        </button>
      </form>
    </details>
  </div>
);

const ServicesPage = async (): Promise<JSX.Element> => {
  let services: ServiceSummary[] = [];
  let loadFailed = false;
  try {
    services = await apiFetch<ServiceSummary[]>('/services');
  } catch {
    loadFailed = true;
  }

  return (
    <section>
      <h1 className="text-4xl">Services</h1>
      <p className="mt-2 text-sm text-white/50">
        The booking screen walks these cards in order — Haircuts, then Beards, then Add-ons, then the car
        wash at branches with bays. Arrange each card here and the customer sees it the same way.
      </p>

      {loadFailed ? (
        <p className="mt-8 rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
          Could not load the menu — try again shortly.
        </p>
      ) : null}

      {SERVICE_CATEGORY_ORDER.map((category) => {
        // Combos are pinned above the rest on the booking screen; show the two
        // groups apart so the arrows behave the way the card actually reads.
        const inCard = services.filter((service) => service.category === category);
        const combos = inCard.filter((service) => service.isComboEligible);
        const rest = inCard.filter((service) => !service.isComboEligible);
        return (
          <div key={category} className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-2xl">{SERVICE_CATEGORY_LABELS[category]}</h2>
              <span className="text-xs text-white/35">{inCard.length} on this card</span>
            </div>
            <p className="mt-1 text-sm text-white/45">{CARD_BLURB[category]}</p>

            {inCard.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
                Nothing on this card yet.
              </p>
            ) : null}

            {combos.length > 0 ? (
              <>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-bronze/70">Combos — shown first</p>
                <div className="mt-2 flex flex-col gap-2">
                  {combos.map((service, index) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      first={index === 0}
                      last={index === combos.length - 1}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {rest.length > 0 ? (
              <>
                {combos.length > 0 ? (
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/30">Everything else</p>
                ) : null}
                <div className="mt-2 flex flex-col gap-2">
                  {rest.map((service, index) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      first={index === 0}
                      last={index === rest.length - 1}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};

export default ServicesPage;
