import { redirect } from 'next/navigation';
import type { JSX, ReactNode } from 'react';
import type { AuthUser } from '@ta-spiru/shared';
import { Sidebar } from '@/components/admin/sidebar';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { apiFetch } from '@/lib/api';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  RECEPTIONIST: 'Reception',
  BARBER: 'Barber',
  WASH_ATTENDANT: 'Car Wash',
};

/** Anyone who works here. A customer holding a session is not one of them. */
const STAFF_ROLES: readonly string[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'BARBER', 'WASH_ATTENDANT'];

const AdminLayout = async ({ children }: { children: ReactNode }): Promise<JSX.Element> => {
  let user: AuthUser | null = null;
  try {
    user = await apiFetch<AuthUser>('/auth/me');
  } catch {
    user = null;
  }
  if (!user) {
    redirect('/admin/login');
  }
  // The real gate: /auth/me verified the token server-side, so this is the
  // role we can trust — the middleware only reads the unverified claim.
  if (!STAFF_ROLES.includes(user.role)) {
    redirect('/account');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-8 px-6 py-8">
      <aside className="w-52 shrink-0">
        <p className="font-display px-3.5 text-3xl text-bronze-light">Ta&rsquo; Spiru</p>
        <p className="font-script px-3.5 text-base leading-tight text-bronze">
          It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
        </p>
        <p className="mb-6 mt-3 px-3.5 text-xs uppercase tracking-[0.25em] text-white/40">
          {user.role === 'RECEPTIONIST' ? 'Reception' : 'Master Admin'}
        </p>
        <Sidebar role={user.role} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-sm text-white/50">Signed in as</p>
            <p className="font-medium">
              {user.firstName} {user.lastName}
              <span className="ml-2 rounded-md bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </p>
          </div>
          <SignOutButton />
        </header>
        {children}
      </div>
      <p
        aria-hidden
        className="font-script pointer-events-none fixed bottom-5 right-8 select-none text-3xl text-white/[0.06]"
      >
        It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!
      </p>
    </div>
  );
};

export default AdminLayout;
