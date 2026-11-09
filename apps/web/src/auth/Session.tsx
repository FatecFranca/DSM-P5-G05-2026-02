import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiRequest, publicApi } from '../services/api';
import type { AuthUser, Tokens } from '../services/contracts';

type Session = { user: AuthUser } | null;
interface SessionContextValue {
  session: Session;
  signIn: (institutionId: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  request: <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT'; body?: object; binary?: boolean }) => Promise<T>;
}
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const tokens = useRef<Tokens | null>(null);
  const generation = useRef(0);
  const refreshing = useRef<Promise<Tokens> | null>(null);

  const signIn = useCallback(async (institutionId: string, email: string, password: string) => {
    const epoch = ++generation.current;
    const next = await publicApi.login(institutionId, email.trim().toLowerCase(), password);
    try {
      const user = await publicApi.me(next.accessToken);
      if (generation.current !== epoch) throw new ApiError('Sessão encerrada.', 401);
      tokens.current = next;
      setSession({ user });
    } catch (error) {
      void publicApi.logout(next.refreshToken).catch(() => undefined);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    generation.current += 1;
    const token = tokens.current?.refreshToken;
    tokens.current = null;
    refreshing.current = null;
    setSession(null);
    if (token) await publicApi.logout(token).catch(() => undefined);
  }, []);

  const request = useCallback(async <T,>(path: string, options: { method?: 'GET' | 'POST' | 'PUT'; body?: object; binary?: boolean } = {}): Promise<T> => {
    const epoch = generation.current;
    const current = tokens.current;
    if (!current) throw new ApiError('Entre para continuar.', 401);
    try {
      return await apiRequest<T>(path, { ...options, accessToken: current.accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || epoch !== generation.current) throw error;
      try {
        refreshing.current ??= publicApi.refresh(tokens.current?.refreshToken ?? '').finally(() => { refreshing.current = null; });
        const next = await refreshing.current;
        if (epoch !== generation.current) throw new ApiError('Sessão encerrada.', 401);
        tokens.current = next;
        return await apiRequest<T>(path, { ...options, accessToken: next.accessToken });
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && epoch === generation.current) {
          tokens.current = null;
          setSession(null);
          generation.current += 1;
        }
        throw retryError;
      }
    }
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    await request<void>('/auth/trocar-senha', { method: 'POST', body: { senhaAtual: current, novaSenha: next } });
    setSession((value) => value ? { user: { ...value.user, trocaSenhaObrigatoria: false } } : value);
  }, [request]);

  return <SessionContext.Provider value={{ session, signIn, signOut, changePassword, request }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider ausente');
  return session;
}
