'use client';

import type { JSX } from 'react';
import { motion } from 'framer-motion';
import { BRANCHES } from '@ta-spiru/shared';

export const Hero = (): JSX.Element => (
  <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 px-6 py-16">
    <motion.header
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <p className="text-sm uppercase tracking-[0.3em] text-bronze">Ta&apos; Spiru</p>
      <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
        A sharp cut. A spotless car. <span className="text-bronze-light">One booking.</span>
      </h1>
    </motion.header>

    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {BRANCHES.map((branch) => (
        <motion.li
          key={branch.slug}
          variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          className="rounded-xl border border-white/10 bg-graphite p-5"
        >
          <p className="font-medium">{branch.name}</p>
          <p className="mt-1 text-sm text-white/60">{branch.descriptor}</p>
        </motion.li>
      ))}
    </motion.ul>
  </main>
);
