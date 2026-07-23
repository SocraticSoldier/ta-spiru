'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { JSX } from 'react';

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/staff', label: 'Staff' },
] as const;

export const Sidebar = (): JSX.Element => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active ? 'bg-bronze/15 text-bronze-light' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};
