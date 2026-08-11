'use client';

import type { JSX, ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * One screen of a step-by-step flow.
 *
 * The whole app is moving from long scrolling pages to this: one decision per
 * screen, a back arrow, and a progress bar so you always know how far in you
 * are. Every flow — booking, the till, staff admin — should use this shell so
 * they all behave the same way.
 */
export const StepScreen = ({
  step,
  total,
  title,
  subtitle,
  onBack,
  footer,
  children,
}: {
  /** 1-based position, used for the counter and the bar. */
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  /** Omit on the first screen — the arrow hides itself. */
  onBack?: () => void;
  /** Continue / skip buttons. Steps that auto-advance leave this out. */
  footer?: ReactNode;
  children: ReactNode;
}): JSX.Element => (
  <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col">
    <div className="flex items-center gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-lg text-white/60 transition hover:border-white/40 hover:text-white"
        >
          ‹
        </button>
      ) : (
        <span className="h-9 w-9 shrink-0" aria-hidden />
      )}
      <span className="text-xs uppercase tracking-[0.2em] text-white/35">
        Step {step} of {total}
      </span>
    </div>

    <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="h-full rounded-full bg-bronze"
        initial={false}
        animate={{ width: `${(step / total) * 100}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </div>

    <motion.div
      key={`${step}-${title}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="flex flex-1 flex-col"
    >
      <h1 className="mt-7 text-3xl leading-tight sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-white/50">{subtitle}</p> : null}

      <div className="mt-6 flex-1">{children}</div>

      {footer ? <div className="sticky bottom-0 mt-6 bg-graphite-deep/90 py-4 backdrop-blur">{footer}</div> : null}
    </motion.div>
  </div>
);

/** A large tappable card — branches, the two brands, anything with a picture. */
export const OptionCard = ({
  title,
  subtitle,
  note,
  imageUrl,
  selected,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  note?: string;
  imageUrl?: string | null;
  selected?: boolean;
  onSelect: () => void;
}): JSX.Element => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`relative flex min-h-[116px] w-full flex-col justify-end overflow-hidden rounded-2xl border p-4 text-left transition ${
      selected ? 'border-bronze' : 'border-white/10 hover:border-white/30'
    }`}
    style={
      imageUrl
        ? {
            backgroundImage: `linear-gradient(to top, rgba(14,14,16,0.94), rgba(14,14,16,0.3)), url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : { background: 'linear-gradient(to top, rgba(14,14,16,0.94), rgba(176,141,87,0.16))' }
    }
  >
    <span className="text-lg font-medium">{title}</span>
    {subtitle ? <span className="mt-0.5 text-xs text-white/55">{subtitle}</span> : null}
    {note ? <span className="mt-1 text-xs text-bronze-light">{note}</span> : null}
  </button>
);

/** A list row — services, people, anything mostly text. */
export const OptionRow = ({
  title,
  meta,
  trailing,
  selected,
  onSelect,
}: {
  title: string;
  meta?: string;
  trailing?: string;
  selected?: boolean;
  onSelect: () => void;
}): JSX.Element => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
      selected ? 'border-bronze bg-bronze/10' : 'border-white/10 bg-graphite/60 hover:border-white/25'
    }`}
  >
    <span className="min-w-0">
      <span className="block truncate font-medium">{title}</span>
      {meta ? <span className="mt-0.5 block text-xs text-white/45">{meta}</span> : null}
    </span>
    {trailing ? <span className="shrink-0 text-sm text-bronze-light">{trailing}</span> : null}
  </button>
);

/** Primary action at the foot of a screen. */
export const ContinueButton = ({
  label = 'Continue',
  disabled,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full rounded-xl bg-bronze py-3.5 font-medium text-graphite-deep transition hover:bg-bronze-light disabled:opacity-40"
  >
    {label}
  </button>
);

/** Secondary action — "Skip", "No thanks". */
export const SkipButton = ({ label = 'Skip', onClick }: { label?: string; onClick: () => void }): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="mt-2 w-full rounded-xl border border-white/15 py-3 text-sm text-white/60 transition hover:text-white"
  >
    {label}
  </button>
);
