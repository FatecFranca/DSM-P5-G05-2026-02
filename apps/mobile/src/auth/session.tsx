import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError, type AuthUser, type Perfil, type TokenResponse, type UserSummary, type RequestOptions } from '@/services/api';
import { api } from '@/services/api-config';
import { canSend } from './route-policy';

const REFRESH_KEY = 'sgei.refreshToken';
let webRefreshToken: string | null = null;

async function readRefreshToken() {
  return Platform.OS === 'web' ? webRefreshToken : SecureStore.getItemAsync(REFRESH_KEY);
}

async function saveRefreshToken(token: string | null) {
  if (Platform.OS === 'web') {
    webRefreshToken = token;
  } else if (token) {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; restoreError?: string }
  | { status: 'signedIn'; user: AuthUser; mode: 'api' | 'demo' };

interface SessionContextValue {
  state: SessionState;
  signIn: (instituicaoId: string, email: string, senha: string) => Promise<void>;
  demoSignIn: (role: 'ADMIN' | 'PROFESSOR' | 'ALUNO') => Promise<void>;
  signOut: () => Promise<boolean>;
  retryRestore: () => Promise<void>;
  listUsers: () => Promise<UserSummary[]>;
  request: <T>(path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<T>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const pendingRefresh = useRef<Promise<string> | null>(null);
  const generation = useRef(0);
  const storageQueue = useRef(Promise.resolve());
  const persist = useCallback((token: string | null) => {
    const next = storageQueue.current.catch(() => undefined).then(() => saveRefreshToken(token));
    storageQueue.current = next;
    return next;
  }, []);

  const acceptTokens = useCallback(async (tokens: TokenResponse, epoch: number) => {
    if (epoch !== generation.current) {
      void api.logout(tokens.refreshToken).catch(() => undefined);
      throw new ApiError('Sessão encerrada.', 401);
    }
    refreshRef.current = tokens.refreshToken;
    accessRef.current = tokens.accessToken;
    await persist(tokens.refreshToken);
    if (epoch !== generation.current) throw new ApiError('Sessão encerrada.', 401);
    return tokens.accessToken;
  }, [persist]);

  const clearLocalSession = useCallback(async () => {
    generation.current += 1;
    pendingRefresh.current = null;
    accessRef.current = null;
    refreshRef.current = null;
    setState({ status: 'signedOut' });
    await persist(null);
  }, [persist]);

  const restore = useCallback(async () => {
    const epoch = generation.current;
    try {
      const token = await readRefreshToken();
      if (epoch !== generation.current) return;
      if (!token) {
        setState({ status: 'signedOut' });
        return;
      }
      refreshRef.current = token;
      const tokens = await api.refresh(token);
      const access = await acceptTokens(tokens, epoch);
      const user = await api.me(access);
      if (epoch !== generation.current) return;
      setState({ status: 'signedIn', user, mode: 'api' });
    } catch (error: unknown) {
      if (epoch !== generation.current) return;
      if (error instanceof ApiError && error.status === 0) {
        setState({ status: 'signedOut', restoreError: 'Não foi possível recuperar a sessão. Confira a conexão.' });
      } else {
        await clearLocalSession();
      }
    }
  }, [acceptTokens, clearLocalSession]);

  const restoring = useRef<Promise<void> | null>(null);
  useEffect(() => {
    restoring.current ??= restore();
  }, [restore]);

  const signIn = useCallback(async (instituicaoId: string, email: string, senha: string) => {
    const epoch = ++generation.current;
    const tokens = await api.login(instituicaoId.trim(), email.trim().toLowerCase(), senha);
    try {
      const access = await acceptTokens(tokens, epoch);
      const user = await api.me(access);
      if (epoch !== generation.current) throw new ApiError('Sessão encerrada.', 401);
      setState({ status: 'signedIn', user, mode: 'api' });
    } catch (error) {
      void api.logout(tokens.refreshToken).catch(() => undefined);
      if (epoch === generation.current) await clearLocalSession();
      throw error;
    }
  }, [acceptTokens, clearLocalSession]);

  const demoSignIn = useCallback(async (role: 'ADMIN' | 'PROFESSOR' | 'ALUNO') => {
    if (!__DEV__) throw new Error('A demonstração local está disponível apenas em desenvolvimento.');
    await clearLocalSession();
    const user: AuthUser = {
      id: `usuario-demo-${role.toLowerCase()}`,
      instituicaoId: '00000000-0000-4000-8000-000000000001',
      perfil: role as Perfil,
      sessaoId: 'sessao-local-demonstrativa',
    };
    accessRef.current = null;
    refreshRef.current = null;
    setState({ status: 'signedIn', user, mode: 'demo' });
  }, [clearLocalSession]);

  const refreshAccess = useCallback(async (): Promise<string> => {
    if (!pendingRefresh.current) {
      const epoch = generation.current;
      const pending = (async () => {
        const token = refreshRef.current;
        if (!token) throw new ApiError('Sessão expirada. Entre novamente.', 401);
        const next = await api.refresh(token);
        return acceptTokens(next, epoch);
      })().finally(() => {
        if (pendingRefresh.current === pending) pendingRefresh.current = null;
      });
      pendingRefresh.current = pending;
    }
    return pendingRefresh.current;
  }, [acceptTokens]);

  const request = useCallback(async <T,>(path: string, options: Omit<RequestOptions, 'accessToken'> = {}): Promise<T> => {
    if (state.status !== 'signedIn' || state.mode !== 'api') throw new ApiError('Entre na API para continuar.', 401);
    if (!canSend(state.user.perfil, options.method ?? 'GET', path)) throw new ApiError('Ação indisponível para este perfil.', 403);
    const epoch = generation.current;
    const access = accessRef.current;
    if (!access) throw new ApiError('Sessão expirada. Entre novamente.', 401);
    try {
      const result = await api.request<T>(path, { ...options, accessToken: access });
      if (epoch !== generation.current) throw new ApiError('Sessão encerrada.', 401);
      return result;
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (epoch !== generation.current) throw error;
      try {
        const token = accessRef.current !== access && accessRef.current ? accessRef.current : await refreshAccess();
        const result = await api.request<T>(path, { ...options, accessToken: token });
        if (epoch !== generation.current) throw new ApiError('Sessão encerrada.', 401);
        return result;
      } catch (retryError: unknown) {
        if (retryError instanceof ApiError && retryError.status === 401 && epoch === generation.current) {
          await clearLocalSession();
        }
        throw retryError;
      }
    }
  }, [clearLocalSession, refreshAccess, state]);
  const listUsers = useCallback(() => request<UserSummary[]>('/usuarios'), [request]);

  const signOut = useCallback(async () => {
    const token = refreshRef.current;
    await clearLocalSession();
    let revoked = !token;
    try {
      if (token) {
        await api.logout(token);
        revoked = true;
      }
    } catch {
      revoked = false;
    }
    return revoked;
  }, [clearLocalSession]);

  const retryRestore = useCallback(async () => {
    setState({ status: 'loading' });
    await restore();
  }, [restore]);

  return (
    <SessionContext.Provider value={{ state, signIn, demoSignIn, signOut, retryRestore, listUsers, request }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession requer SessionProvider');
  return context;
}
