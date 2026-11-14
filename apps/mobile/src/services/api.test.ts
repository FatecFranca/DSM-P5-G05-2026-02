import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiClient, ApiError } from './api.ts';

test('transporte não recebe ApiClient como this no navegador', async () => {
  const transport: typeof fetch = function (this: unknown) {
    assert.equal(this, undefined);
    return Promise.resolve(Response.json({ status: 'ok' }));
  };
  assert.deepEqual(await new ApiClient('http://localhost:3000', transport).health(), { status: 'ok' });
});

test('upload preserva multipart e download preserva bytes', async () => {
  const form = new FormData();
  form.append('arquivo', new Blob(['%PDF-test']), 'teste.pdf');
  const client = new ApiClient('http://localhost:3000', async (_url, options) => {
    assert.equal(options?.body, form);
    assert.equal((options?.headers as Record<string, string>)['Content-Type'], undefined);
    assert.equal((options?.headers as Record<string, string>).Authorization, 'token'.replace(/^/, 'Bearer '));
    return Response.json({ id: 'arquivo' });
  });
  assert.deepEqual(await client.request('/arquivos', { method: 'POST', body: form, accessToken: 'token' }), { id: 'arquivo' });
  const download = new ApiClient('http://localhost:3000', async () => new Response(new Uint8Array([1, 2, 3])));
  assert.deepEqual(new Uint8Array(await download.request<ArrayBuffer>('/arquivos/id', { binary: true })), new Uint8Array([1, 2, 3]));
});

test('validação do servidor mantém mensagens úteis e rotas externas são rejeitadas', async () => {
  const client = new ApiClient('http://localhost:3000', async () => Response.json({ message: ['Campo inválido', 'Nota acima do máximo'] }, { status: 400 }));
  await assert.rejects(client.request('/avaliacoes', { method: 'POST' }), /Nota acima do máximo/);
  await assert.rejects(client.request('//outro-servidor/'), /Rota inválida/);
});

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

test('lista instituições sem autenticação para a escolha no login', async () => {
  let receivedUrl = '';
  let authorization: string | undefined;
  const client = new ApiClient('http://localhost:3000', async (url, options) => {
    receivedUrl = String(url);
    authorization = (options?.headers as Record<string, string>).Authorization;
    return Response.json([{ id: 'id-interno', nome: 'Fatec São Paulo' }]);
  });
  assert.deepEqual(await client.listInstituicoes(), [{ id: 'id-interno', nome: 'Fatec São Paulo' }]);
  assert.equal(receivedUrl, 'http://localhost:3000/auth/instituicoes');
  assert.equal(authorization, undefined);
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
