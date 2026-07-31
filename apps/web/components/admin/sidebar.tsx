'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { JSX } from 'react';
import type { RoleName } from '@ta-spiru/shared';

interface NavLink {
  href: string;
  label: string;
  roles: readonly RoleName[] | 'all';
}

const LINKS: readonly NavLink[] = [
  { href: '/admin', label: 'Dashboard', roles: 'all' },
  { href: '/admin/calendar', label: 'Calendar', roles: 'all' },
  { href: '/admin/queue', label: 'Queue', roles: 'all' },
  { href: '/admin/inventory', label: 'Inventory', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/admin/transactions', label: 'Transactions', roles: ['ADMIN'] },
  { href: '/admin/staff', label: 'Staff', roles: ['ADMIN', 'MANAGER'] },
  { href: '/admin/services', label: 'Services', roles: ['ADMIN', 'MANAGER'] },
  { href: '/admin/coupons', label: 'Coupons', roles: ['ADMIN', 'MANAGER'] },
  { href: '/kiosk', label: 'Clock-in kiosk', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
];

export const Sidebar = ({ role }: { role: RoleName }): JSX.Element => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.filter((link) => link.roles === 'all' || link.roles.includes(role)).map((link) => {
        const active = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-3.5 py-2 text-sm transition ${
              active
                ? 'bg-gradient-to-r from-bronze/25 to-bronze/5 text-bronze-light shadow-[inset_0_0_0_1px_rgba(176,141,87,0.35)]'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};
