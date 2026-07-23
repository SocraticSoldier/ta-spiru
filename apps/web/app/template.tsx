'use client';

import type { JSX, ReactNode } from 'react';
import { motion } from 'framer-motion';

/** Fluid page transition applied to every route (blueprint §5, motion guidelines). */
const Template = ({ children }: { children: ReactNode }): JSX.Element => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

export default Template;
