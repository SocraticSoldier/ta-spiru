'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const INTRO_KEY = 'ts-intro-seen';
const INTRO_TOTAL_MS = 3400;

const Intro = ({ onDone }: { onDone: () => void }): JSX.Element => {
  useEffect(() => {
    const timer = setTimeout(onDone, INTRO_TOTAL_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      key="intro"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-graphite-deep px-6"
      exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeInOut' } }}
      onClick={onDone}
    >
      <motion.p
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="font-display text-6xl text-bronze-light sm:text-8xl"
      >
        Ta&rsquo; Spiru
      </motion.p>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.7, duration: 0.9, ease: 'easeInOut' }}
        className="mt-6 h-px w-56 origin-center bg-gradient-to-r from-transparent via-bronze to-transparent"
      />
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 1.0, ease: 'easeOut' }}
        className="font-script mt-7 max-w-xl text-center text-3xl text-bronze sm:text-4xl"
      >
        It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 0.6 }}
        className="mt-10 text-xs uppercase tracking-[0.35em] text-white/30"
      >
        Tap to enter
      </motion.p>
    </motion.div>
  );
};

interface PanelProps {
  href: string;
  eyebrow: string;
  title: string;
  copy: string;
  accentClass: string;
  glow: string;
  hovered: boolean;
  dimmed: boolean;
  onHover: (state: boolean) => void;
  delay: number;
}

const Panel = ({
  href,
  eyebrow,
  title,
  copy,
  accentClass,
  glow,
  hovered,
  dimmed,
  onHover,
  delay,
}: PanelProps): JSX.Element => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.7, ease: 'easeOut' }}
    className="min-h-0 flex-1 transition-[flex-grow] duration-500 ease-out lg:min-h-full"
    style={{ flexGrow: hovered ? 1.35 : 1 }}
    onMouseEnter={() => onHover(true)}
    onMouseLeave={() => onHover(false)}
  >
    <Link
      href={href}
      className={`group relative flex h-full min-h-[42vh] flex-col justify-end overflow-hidden p-8 transition-opacity duration-500 sm:p-12 lg:min-h-screen ${
        dimmed ? 'opacity-60' : 'opacity-100'
      }`}
      style={{ background: glow }}
    >
      <div className="relative z-10">
        <p className={`font-script text-3xl ${accentClass}`}>{eyebrow}</p>
        <h2 className="mt-2 text-5xl text-white sm:text-6xl">{title}</h2>
        <p className="mt-4 max-w-sm text-white/60">{copy}</p>
        <span
          className={`mt-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] ${accentClass}`}
        >
          Explore
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">
            →
          </span>
        </span>
      </div>
    </Link>
  </motion.div>
);

export const IntroSplit = (): JSX.Element => {
  const [phase, setPhase] = useState<'loading' | 'intro' | 'split'>('loading');
  const [hovered, setHovered] = useState<'barber' | 'wash' | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = sessionStorage.getItem(INTRO_KEY) === '1';
    setPhase(seen || reduced ? 'split' : 'intro');
  }, []);

  const finishIntro = (): void => {
    sessionStorage.setItem(INTRO_KEY, '1');
    setPhase('split');
  };

  return (
    <main className="min-h-screen">
      <AnimatePresence>{phase === 'intro' ? <Intro onDone={finishIntro} /> : null}</AnimatePresence>

      {phase !== 'loading' ? (
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Panel
            href="/barber"
            eyebrow="The Barber"
            title="Barbering"
            copy="Fades, sculpted beards, hot-towel rituals and facial treatments across five branches in Malta."
            accentClass="text-bronze-light"
            glow="radial-gradient(120% 90% at 30% 100%, rgba(176,141,87,0.28), rgba(14,14,16,0.98) 65%)"
            hovered={hovered === 'barber'}
            dimmed={hovered === 'wash'}
            onHover={(state) => setHovered(state ? 'barber' : null)}
            delay={0.05}
          />
          <div className="relative z-10 hidden w-px bg-white/10 lg:block" />
          <Panel
            href="/wash"
            eyebrow="The Car Wash"
            title="Car Detailing"
            copy="Premium valeting, ceramic coating and the Combo Wash & Cut — your car detailed while you get sharp."
            accentClass="text-wash-light"
            glow="radial-gradient(120% 90% at 70% 100%, rgba(63,193,176,0.22), rgba(14,14,16,0.98) 65%)"
            hovered={hovered === 'wash'}
            dimmed={hovered === 'barber'}
            onHover={(state) => setHovered(state ? 'wash' : null)}
            delay={0.15}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-center pt-8">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col items-center"
            >
              <p className="font-display text-3xl text-white/90">Ta&rsquo; Spiru</p>
              <p className="font-script mt-0.5 text-lg text-bronze">
                It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
              </p>
              <Link
                href="/book"
                className="pointer-events-auto mt-4 rounded-full bg-bronze px-6 py-2 text-sm font-semibold uppercase tracking-[0.15em] text-graphite-deep transition hover:bg-bronze-light"
              >
                Book now
              </Link>
            </motion.div>
          </div>
        </div>
      ) : null}
    </main>
  );
};
