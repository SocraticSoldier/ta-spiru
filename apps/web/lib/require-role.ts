import { redirect } from 'next/navigation';
import type { AuthUser, RoleName } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';

/**
 * Server-side role gate for a staff page.
 *
 * Hiding a link in the sidebar is presentation, not protection — anyone can
 * type the path. Pages that show money or change the menu call this so the
 * route itself is closed to roles that should not have it.
 *
 * The role comes from /auth/me, so it is read from a token the API has
 * verified rather than anything the browser supplied.
 */
export const requireRole = async (...allowed: readonly RoleName[]): Promise<AuthUser> => {
  let user: AuthUser | null = null;
  try {
    user = await apiFetch<AuthUser>('/auth/me');
  } catch {
    user = null;
  }
  if (!user) {
    redirect('/admin/login');
  }
  if (!allowed.includes(user.role)) {
    // Back to the part of the portal they do have, rather than a dead end.
    redirect('/admin');
  }
  return user;
};
