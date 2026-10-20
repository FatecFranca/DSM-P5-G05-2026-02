import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError, type AuthUser, type Perfil, type TokenResponse, type UserSummary } from '@/services/api';
import { api } from '@/services/api-config';

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
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const pendingRefresh = useRef<Promise<string> | null>(null);

  const acceptTokens = useCallback(async (tokens: TokenResponse) => {
    await saveRefreshToken(tokens.refreshToken);
    refreshRef.current = tokens.refreshToken;
    accessRef.current = tokens.accessToken;
    return tokens.accessToken;
  }, []);

  const clearLocalSession = useCallback(async () => {
    accessRef.current = null;
    refreshRef.current = null;
    await saveRefreshToken(null);
    setState({ status: 'signedOut' });
  }, []);

  const restore = useCallback(async () => {
    try {
      const token = await readRefreshToken();
      if (!token) {
        setState({ status: 'signedOut' });
        return;
      }
      refreshRef.current = token;
      const tokens = await api.refresh(token);
      const access = await acceptTokens(tokens);
      const user = await api.me(access);
      setState({ status: 'signedIn', user, mode: 'api' });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 0) {
        setState({ status: 'signedOut', restoreError: 'Não foi possível recuperar a sessão. Confira a conexão.' });
      } else {
        await clearLocalSession();
      }
    }
  }, [acceptTokens, clearLocalSession]);

  useEffect(() => {
    void Promise.resolve().then(restore);
  }, [restore]);

  const signIn = useCallback(async (instituicaoId: string, email: string, senha: string) => {
    const tokens = await api.login(instituicaoId.trim(), email.trim().toLowerCase(), senha);
    const access = await acceptTokens(tokens);
    const user = await api.me(access);
    setState({ status: 'signedIn', user, mode: 'api' });
  }, [acceptTokens]);

  const demoSignIn = useCallback(async (role: 'ADMIN' | 'PROFESSOR' | 'ALUNO') => {
    if (!__DEV__) throw new Error('A demonstração local está disponível apenas em desenvolvimento.');
    await saveRefreshToken(null);
    const user: AuthUser = {
      id: `usuario-demo-${role.toLowerCase()}`,
      instituicaoId: '00000000-0000-4000-8000-000000000001',
      perfil: role as Perfil,
      sessaoId: 'sessao-local-demonstrativa',
    };
    accessRef.current = null;
    refreshRef.current = null;
    setState({ status: 'signedIn', user, mode: 'demo' });
  }, []);

  const refreshAccess = useCallback(async (): Promise<string> => {
    if (!pendingRefresh.current) {
      pendingRefresh.current = (async () => {
        const token = refreshRef.current ?? (await readRefreshToken());
        if (!token) throw new ApiError('Sessão expirada. Entre novamente.', 401);
        const next = await api.refresh(token);
        return acceptTokens(next);
      })().finally(() => {
        pendingRefresh.current = null;
      });
    }
    return pendingRefresh.current;
  }, [acceptTokens]);

  const listUsers = useCallback(async () => {
    if (state.status === 'signedIn' && state.mode === 'demo') throw new ApiError('A consulta de usuários exige login real na API.', 403);
    const access = accessRef.current;
    if (!access) throw new ApiError('Sessão expirada. Entre novamente.', 401);
    try {
      return await api.users(access);
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      try {
        return await api.users(await refreshAccess());
      } catch (retryError: unknown) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          await clearLocalSession();
        }
        throw retryError;
      }
    }
  }, [clearLocalSession, refreshAccess, state]);

  const signOut = useCallback(async () => {
    const token = refreshRef.current ?? (await readRefreshToken());
    let revoked = !token;
    try {
      if (token) {
        await api.logout(token);
        revoked = true;
      }
    } catch {
      revoked = false;
    } finally {
      await clearLocalSession();
    }
    return revoked;
  }, [clearLocalSession]);

  const retryRestore = useCallback(async () => {
    setState({ status: 'loading' });
    await restore();
  }, [restore]);

  return (
    <SessionContext.Provider value={{ state, signIn, demoSignIn, signOut, retryRestore, listUsers }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession requer SessionProvider');
  return context;
}
