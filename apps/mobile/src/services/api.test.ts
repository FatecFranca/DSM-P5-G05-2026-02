import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiClient, ApiError } from './api.ts';

test('login envia o contrato esperado pelo Nest', async () => {
  let receivedUrl = '';
  let receivedOptions: RequestInit | undefined;
  const transport: typeof fetch = async (url, options) => {
    receivedUrl = String(url);
    receivedOptions = options;
    return Response.json({ accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 900 });
  };

  const client = new ApiClient('http://localhost:3000/', transport);
  await client.login('instituicao', 'aluno@exemplo.com', 'senha');

  assert.equal(receivedUrl, 'http://localhost:3000/auth/login');
  assert.equal(receivedOptions?.method, 'POST');
  assert.deepEqual(JSON.parse(String(receivedOptions?.body)), {
    instituicaoId: 'instituicao',
    email: 'aluno@exemplo.com',
    senha: 'senha',
  });
  assert.equal((receivedOptions?.headers as Record<string, string>)?.Authorization, undefined);
});

test('requisição protegida envia Bearer e preserva 401', async () => {
  let authorization = '';
  const transport: typeof fetch = async (_url, options) => {
    authorization = (options?.headers as Record<string, string>).Authorization;
    return Response.json({ message: 'Sessão expirada' }, { status: 401 });
  };
  const client = new ApiClient('http://localhost:3000', transport);

  await assert.rejects(client.me('token'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    return true;
  });
  assert.equal(authorization, 'Bearer token');
});

test('falha de rede produz mensagem controlada', async () => {
  const client = new ApiClient('http://localhost:3000', async () => {
    throw new Error('detalhes internos');
  });
  await assert.rejects(client.health(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.doesNotMatch(error.message, /detalhes internos/);
    return true;
  });
});

test('refresh e logout usam o token no corpo e aceitam resposta sem conteúdo', async () => {
  const calls: { url: string; body: unknown }[] = [];
  const transport: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return String(url).endsWith('/auth/logout')
      ? new Response(null, { status: 204 })
      : Response.json({ accessToken: 'novo', refreshToken: 'rotacionado', tokenType: 'Bearer', expiresIn: 900 });
  };
  const client = new ApiClient('http://localhost:3000', transport);

  const rotated = await client.refresh('original');
  const logout = await client.logout(rotated.refreshToken);

  assert.equal(rotated.accessToken, 'novo');
  assert.equal(logout, undefined);
  assert.deepEqual(calls, [
    { url: 'http://localhost:3000/auth/refresh', body: { refreshToken: 'original' } },
    { url: 'http://localhost:3000/auth/logout', body: { refreshToken: 'rotacionado' } },
  ]);
});
