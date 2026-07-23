import { redirect } from 'next/navigation';
import type { JSX, ReactNode } from 'react';
import type { AuthUser } from '@ta-spiru/shared';
import { Sidebar } from '@/components/admin/sidebar';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { apiFetch } from '@/lib/api';

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

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-6 py-8">
      <aside className="w-52 shrink-0">
        <p className="px-3 text-xs uppercase tracking-[0.3em] text-bronze">Ta&apos; Spiru</p>
        <p className="mb-6 mt-1 px-3 text-sm text-white/50">Master Admin</p>
        <Sidebar />
      </aside>
      <div className="flex-1">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-sm text-white/50">Signed in as</p>
            <p className="font-medium">
              {user.firstName} {user.lastName}
              <span className="ml-2 rounded bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">
                {user.role}
              </span>
            </p>
          </div>
          <SignOutButton />
        </header>
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
