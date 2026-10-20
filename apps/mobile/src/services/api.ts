export type Perfil = 'ADMIN' | 'COORDENACAO' | 'PROFESSOR' | 'TUTOR' | 'ALUNO';

export interface AuthUser {
  id: string;
  instituicaoId: string;
  perfil: Perfil;
  sessaoId: string;
}

export interface UserSummary {
  id: string;
  instituicaoId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  criadoEm: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: object;
  accessToken?: string;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly transport: typeof fetch;

  constructor(
    baseUrl: string,
    transport: typeof fetch = fetch,
  ) {
    const parsed = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('A URL da API deve usar HTTP ou HTTPS');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.transport = transport;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.transport(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.accessToken
            ? { Authorization: `Bearer ${options.accessToken}` }
            : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch {
      throw new ApiError('Não foi possível conectar à API. Confira o endereço e a rede.', 0);
    }

    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? payload.message
          : null;
      throw new ApiError(
        typeof message === 'string' ? message : 'A solicitação não pôde ser concluída.',
        response.status,
      );
    }
    return payload as T;
  }

  health() {
    return this.request<{ status: 'ok' }>('/auth/health');
  }

  login(instituicaoId: string, email: string, senha: string) {
    return this.request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { instituicaoId, email, senha },
    });
  }

  refresh(refreshToken: string) {
    return this.request<TokenResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  logout(refreshToken: string) {
    return this.request<void>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  me(accessToken: string) {
    return this.request<AuthUser>('/auth/me', { accessToken });
  }

  users(accessToken: string) {
    return this.request<UserSummary[]>('/usuarios', { accessToken });
  }
}
