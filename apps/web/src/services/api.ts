import type { AcademicSnapshot, AuthUser, Institution, Tokens } from './contracts';

const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
if (!baseUrl.startsWith('/') && !/^https?:\/\//.test(baseUrl)) throw new Error('URL da API inválida');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

interface RequestOptions { method?: 'GET' | 'POST' | 'PUT'; body?: object; accessToken?: string; binary?: boolean }

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('Rota inválida');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET', signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError(controller.signal.aborted ? 'A API demorou para responder. Tente novamente.' : 'Não foi possível conectar à API.', 0);
  } finally { clearTimeout(timeout); }
  if (response.status === 204) return undefined as T;
  if (response.ok && options.binary) return await response.arrayBuffer() as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data ? data.message : null;
    throw new ApiError(typeof message === 'string' ? message : Array.isArray(message) ? message.join(' ') : 'Não foi possível concluir a solicitação.', response.status);
  }
  return data as T;
}

export const publicApi = {
  institutions: () => apiRequest<Institution[]>('/auth/instituicoes'),
  login: (instituicaoId: string, email: string, senha: string) => apiRequest<Tokens>('/auth/login', { method: 'POST', body: { instituicaoId, email, senha } }),
  me: (accessToken: string) => apiRequest<AuthUser>('/auth/me', { accessToken }),
  refresh: (refreshToken: string) => apiRequest<Tokens>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: (refreshToken: string) => apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
};

export const academicApi = {
  snapshot: (request: <T>(path: string) => Promise<T>, turmaId?: string) => request<AcademicSnapshot>(`/academico/resumo${turmaId ? `?turmaId=${encodeURIComponent(turmaId)}` : ''}`),
};
