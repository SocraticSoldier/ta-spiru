import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '@ta-spiru/shared';
import { api, tokenStore } from './api';

interface SessionValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async (): Promise<void> => {
      const token = await tokenStore.get();
      if (token) {
        try {
          setUser(await api.me());
        } catch {
          await tokenStore.clear();
        }
      }
      setLoading(false);
    };
    void restore();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const { accessToken, user: authUser } = await api.login(email, password);
    await tokenStore.set(accessToken);
    setUser(authUser);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; firstName: string; lastName: string }): Promise<void> => {
      const { accessToken, user: authUser } = await api.register(input);
      await tokenStore.set(accessToken);
      setUser(authUser);
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, loading, signIn, register, signOut }),
    [user, loading, signIn, register, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
