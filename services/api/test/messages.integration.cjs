// Teste de integração de mensagens: usa duas Fatecs do catálogo e remove somente o que cria.
// Rode após build + migração, com a API e o PostgreSQL locais. Veja docs/messages-api.md.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { rmSync } = require('node:fs');
const { resolve } = require('node:path');
const argon2 = require('argon2');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const dbUrl = new URL(process.env.DATABASE_URL);
// Fora da rede do Compose o banco é alcançado pela porta publicada; dentro dela, pelo nome `db`.
if (dbUrl.hostname === 'db' && process.env.TEST_DB_IN_NETWORK !== 'true') dbUrl.hostname = '127.0.0.1';
assert.ok(
  ['localhost', '127.0.0.1'].includes(dbUrl.hostname) || (dbUrl.hostname === 'db' && process.env.TEST_DB_IN_NETWORK === 'true'),
  'Teste permitido somente em banco local',
);
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString() }) });

const runId = randomUUID();
const tenants = [];
const testUserIds = [];
const classNames = { a: `Teste mensagens A ${runId}`, b: `Teste mensagens B ${runId}` };
const uploaded = [];
let checks = 0;

async function call(method, path, token, body, expected = 200, attempt = 0) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
  });
  // O limitador é por rota e por IP (login: 5/min). Espera o tempo indicado e repete.
  if (response.status === 429 && expected !== 429 && attempt < 3) {
    const seconds = Number(response.headers.get('retry-after'));
    await new Promise((done) => setTimeout(done, Number.isFinite(seconds) && seconds > 0 ? Math.min(61_000, seconds * 1000 + 1000) : 61_000));
    return call(method, path, token, body, expected, attempt + 1);
  }
  const bytes = await response.arrayBuffer();
  const isJson = response.headers.get('content-type')?.includes('application/json') && bytes.byteLength;
  const value = isJson ? JSON.parse(Buffer.from(bytes).toString()) : bytes;
  assert.equal(response.status, expected, `${method} ${path}: ${response.status}; ${isJson ? JSON.stringify(value) : ''}`);
  checks++;
  return value;
}

const pdf = (label) => {
  const form = new FormData();
  form.append('arquivo', new Blob([`%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%% ${label}\n%%EOF`], { type: 'application/pdf' }), `${label}.pdf`);
  return form;
};
async function upload(token, label) {
  const file = await call('POST', '/arquivos', token, pdf(label), 201);
  uploaded.push(file.id);
  return file;
}
const section = (title) => console.log(`- ${title}`);

async function main() {
  const senha = randomUUID() + 'A!';
  const senhaHash = await argon2.hash(senha);
  for (const codigoCps of ['109', '002']) {
    const fatec = await db.instituicao.findUnique({ where: { codigoCps }, select: { id: true, ativa: true } });
    assert.ok(fatec?.ativa, `Fatec ${codigoCps} deve existir e estar ativa`);
    tenants.push(fatec.id);
  }
  const roster = [
    ['admin', 'COORDENACAO', 0, 'Coordenação Teste'],
    ['secretaria', 'SECRETARIA', 0, 'Secretaria Teste'],
    ['teacher', 'PROFESSOR', 0, 'Prof Matemática'],
    ['teacher2', 'PROFESSOR', 0, 'Prof Física'],
    ['tutor', 'TUTOR', 0, 'Tutor Teste'],
    ['s1', 'ALUNO', 0, 'Ana Aluna'],
    ['s2', 'ALUNO', 0, 'Beto Aluno'],
    ['s3', 'ALUNO', 0, 'Caio Outra Turma'],
    ['outsider', 'ALUNO', 1, 'Duda Outra Fatec'],
  ];
  const who = {};
  for (const [key, perfil, tenant, nome] of roster) {
    const user = await db.usuario.create({ data: { instituicaoId: tenants[tenant], email: `${key}.${runId}@example.test`, nome, senhaHash, perfil } });
    testUserIds.push(user.id);
    const tokens = await call('POST', '/auth/login', null, { instituicaoId: user.instituicaoId, email: user.email, senha });
    who[key] = { ...user, token: tokens.accessToken };
  }
  const { admin, secretaria, teacher, teacher2, tutor, s1, s2, s3, outsider } = who;

  // ------------------------------------------------------------------ cenário acadêmico
  const turma = await call('POST', '/turmas', admin.token, { nome: classNames.a, curso: 'Teste', periodo: '2026/2' }, 201);
  const turmaB = await call('POST', '/turmas', admin.token, { nome: classNames.b, curso: 'Teste', periodo: '2026/2' }, 201);
  const mat = await call('POST', '/disciplinas', admin.token, { turmaId: turma.id, nome: 'Matemática' }, 201);
  const fis = await call('POST', '/disciplinas', admin.token, { turmaId: turma.id, nome: 'Física' }, 201);
  await call('POST', '/lotacoes', admin.token, { disciplinaId: mat.id, professorId: teacher.id }, 201);
  await call('POST', '/lotacoes', admin.token, { disciplinaId: fis.id, professorId: teacher2.id }, 201);
  const enrol1 = await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: s1.id, registro: `M1-${runId.slice(0, 8)}` }, 201);
  await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: s2.id, registro: `M2-${runId.slice(0, 8)}` }, 201);
  await call('POST', '/matriculas', admin.token, { turmaId: turmaB.id, alunoId: s3.id, registro: `M3-${runId.slice(0, 8)}` }, 201);
  await call('POST', '/tutorias', admin.token, { matriculaId: enrol1.id, tutorId: tutor.id }, 201);
  const geral = `${turma.id}:geral`;
  const matKey = `${turma.id}:${mat.id}`;
  const fisKey = `${turma.id}:${fis.id}`;

  // ------------------------------------------------------------------ perfis e autenticação
  section('perfis e autenticação');
  for (const path of ['/mensagens/resumo', '/mensagens/conversas', '/mensagens/canais', '/mensagens/contatos']) {
    await call('GET', path, null, null, 401);
    await call('GET', path, secretaria.token, null, 403);
    await call('GET', path, admin.token, null, 403);
  }
  await call('GET', '/mensagens/conversas', tutor.token, null, 403);
  await call('GET', '/mensagens/contatos', tutor.token, null, 403);
  await call('POST', '/mensagens/conversas', tutor.token, { participanteIds: [s1.id] }, 403);
  await call('POST', '/mensagens/curtidas', tutor.token, { tipo: 'MENSAGEM', id: randomUUID() }, 403);

  // ------------------------------------------------------------------ contatos
  section('contatos');
  const contacts = await call('GET', '/mensagens/contatos', s1.token);
  assert.deepEqual(contacts.map((c) => c.nome).sort(), ['Beto Aluno', 'Prof Física', 'Prof Matemática']);
  assert.ok(contacts.every((c) => c.id !== s1.id && c.turmas.includes(classNames.a)));
  assert.deepEqual((await call('GET', '/mensagens/contatos?q=beto', s1.token)).map((c) => c.nome), ['Beto Aluno']);
  assert.deepEqual(await call('GET', '/mensagens/contatos?q=zzzz', s1.token), []);
  assert.deepEqual((await call('GET', '/mensagens/contatos', s3.token)).map((c) => c.nome), []);
  assert.deepEqual(await call('GET', '/mensagens/contatos', outsider.token), []);
  assert.deepEqual((await call('GET', '/mensagens/contatos', teacher.token)).map((c) => c.nome).sort(), ['Ana Aluna', 'Beto Aluno', 'Prof Física']);

  // ------------------------------------------------------------------ conversas
  section('conversas: criação, idempotência e regras');
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [] }, 400);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [s1.id] }, 400);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: ['nao-uuid'] }, 400);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [s2.id], extra: 1 }, 400);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [randomUUID()] }, 404);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [outsider.id] }, 404);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [tutor.id] }, 404);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [s3.id] }, 403);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [s2.id, teacher.id] }, 400);
  const direct = await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [s2.id] }, 201);
  assert.equal(direct.tipo, 'DIRETA');
  assert.equal(direct.participantes.length, 2);
  assert.equal(direct.naoLidas, 0);
  const again = await call('POST', '/mensagens/conversas', s2.token, { participanteIds: [s1.id] }, 201);
  assert.equal(again.id, direct.id, 'o par de pessoas tem uma única conversa direta');
  const group = await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [s2.id, teacher.id], titulo: 'Grupo de estudo' }, 201);
  assert.equal(group.tipo, 'GRUPO');
  assert.equal(group.titulo, 'Grupo de estudo');
  assert.equal(group.participantes.length, 3);
  await call('POST', '/mensagens/conversas', teacher.token, { participanteIds: [teacher2.id] }, 201);

  section('conversas: criação simultânea do mesmo par');
  const [race1, race2] = await Promise.all([
    call('POST', '/mensagens/conversas', s2.token, { participanteIds: [teacher2.id] }, 201),
    call('POST', '/mensagens/conversas', teacher2.token, { participanteIds: [s2.id] }, 201),
  ]);
  assert.equal(race1.id, race2.id);
  const [low, high] = [s2.id, teacher2.id].sort();
  assert.equal(await db.conversa.count({ where: { instituicaoId: tenants[0], chaveDireta: `${low}:${high}` } }), 1);

  // ------------------------------------------------------------------ mensagens
  section('mensagens: envio, não lidas e leitura');
  const first = await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: '  Oi, tudo bem?  ' }, 201);
  assert.equal(first.texto, 'Oi, tudo bem?');
  assert.equal(first.autorId, s1.id);
  assert.equal(first.curtidas, 0);
  assert.equal(first.curtidaPorMim, false);
  const listFor = async (user, id) => (await call('GET', '/mensagens/conversas', user.token)).find((c) => c.id === id);
  assert.equal((await listFor(s1, direct.id)).naoLidas, 0, 'a própria mensagem não conta');
  const seen = await listFor(s2, direct.id);
  assert.equal(seen.naoLidas, 1);
  assert.equal(seen.ultimaMensagem.texto, 'Oi, tudo bem?');
  assert.equal(seen.ultimaMensagem.autor, 'Ana Aluna');
  assert.equal((await call('GET', '/mensagens/resumo', s2.token)).conversas, 1);
  const detail = await call('GET', `/mensagens/conversas/${direct.id}`, s2.token);
  assert.deepEqual([detail.id, detail.tipo, detail.naoLidas, detail.participantes.length], [direct.id, 'DIRETA', 1, 2]);
  await call('GET', `/mensagens/conversas/${direct.id}`, s3.token, null, 404);
  await call('GET', `/mensagens/conversas/${direct.id}`, outsider.token, null, 404);
  await call('GET', `/mensagens/conversas/${direct.id}`, tutor.token, null, 403);
  assert.equal((await call('GET', `/mensagens/conversas/${direct.id}/mensagens`, s2.token)).itens.length, 1);
  for (const stranger of [s3, outsider, teacher, tutor]) {
    const expected = stranger === tutor ? 403 : 404;
    await call('GET', `/mensagens/conversas/${direct.id}/mensagens`, stranger.token, null, expected);
    await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, stranger.token, { texto: 'intrusão' }, expected);
    await call('PUT', `/mensagens/conversas/${direct.id}/leitura`, stranger.token, null, expected);
  }
  await call('PUT', `/mensagens/conversas/${direct.id}/leitura`, s2.token);
  assert.equal((await listFor(s2, direct.id)).naoLidas, 0);
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s2.token, { texto: 'Tudo!' }, 201);
  assert.equal((await listFor(s1, direct.id)).naoLidas, 1);
  await call('GET', '/mensagens/conversas/nao-uuid/mensagens', s1.token, null, 400);

  section('mensagens: validação');
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: '   ' }, 400);
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, {}, 400);
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: 'x'.repeat(2001) }, 400);
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: 'x'.repeat(2600) }, 400);
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: 'a', autorId: s2.id }, 400);
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { arquivoId: randomUUID() }, 404);

  section('mensagens: paginação por cursor');
  for (let i = 1; i <= 4; i++) await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: `Mensagem ${i}` }, 201);
  const page1 = await call('GET', `/mensagens/conversas/${direct.id}/mensagens?limite=3`, s1.token);
  assert.equal(page1.itens.length, 3);
  assert.equal(page1.temMais, true);
  assert.deepEqual(page1.itens.map((m) => m.texto), ['Mensagem 2', 'Mensagem 3', 'Mensagem 4'], 'ordem cronológica, as mais recentes primeiro na página');
  const page2 = await call('GET', `/mensagens/conversas/${direct.id}/mensagens?limite=3&antes=${page1.itens[0].id}`, s1.token);
  assert.deepEqual(page2.itens.map((m) => m.texto), ['Oi, tudo bem?', 'Tudo!', 'Mensagem 1']);
  assert.equal(page2.temMais, false);
  await call('GET', `/mensagens/conversas/${direct.id}/mensagens?antes=${randomUUID()}`, s1.token, null, 400);
  await call('GET', `/mensagens/conversas/${direct.id}/mensagens?limite=0`, s1.token, null, 400);
  await call('GET', `/mensagens/conversas/${direct.id}/mensagens?limite=101`, s1.token, null, 400);
  const groupMessage = await call('POST', `/mensagens/conversas/${group.id}/mensagens`, teacher.token, { texto: 'Vamos nos reunir?' }, 201);
  await call('GET', `/mensagens/conversas/${direct.id}/mensagens?antes=${groupMessage.id}`, s1.token, null, 400);

  section('curtidas em mensagens');
  const liked = await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'MENSAGEM', id: first.id }, 201);
  assert.deepEqual(liked, { curtidas: 1, curtidaPorMim: true });
  const mine = (await call('GET', `/mensagens/conversas/${direct.id}/mensagens?limite=100`, s2.token)).itens.find((m) => m.id === first.id);
  assert.deepEqual([mine.curtidas, mine.curtidaPorMim], [1, true]);
  const theirs = (await call('GET', `/mensagens/conversas/${direct.id}/mensagens?limite=100`, s1.token)).itens.find((m) => m.id === first.id);
  assert.deepEqual([theirs.curtidas, theirs.curtidaPorMim], [1, false]);
  assert.deepEqual(await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'MENSAGEM', id: first.id }, 201), { curtidas: 0, curtidaPorMim: false });
  await call('POST', '/mensagens/curtidas', s3.token, { tipo: 'MENSAGEM', id: first.id }, 404);
  await call('POST', '/mensagens/curtidas', outsider.token, { tipo: 'MENSAGEM', id: first.id }, 404);
  await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'OUTRO', id: first.id }, 400);
  await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'MENSAGEM', id: 'x' }, 400);

  // ------------------------------------------------------------------ anexos em conversas
  section('anexos em conversas');
  const fileA = await upload(s1.token, 'anexo-conversa');
  const withFile = await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { arquivoId: fileA.id }, 201);
  assert.equal(withFile.texto, '');
  assert.equal(withFile.arquivo.nome, 'anexo-conversa.pdf');
  assert.equal((await listFor(s2, direct.id)).ultimaMensagem.arquivo, 'anexo-conversa.pdf');
  await call('GET', `/arquivos/${fileA.id}`, s2.token);
  for (const stranger of [s3, outsider, teacher, teacher2, tutor]) await call('GET', `/arquivos/${fileA.id}`, stranger.token, null, 404);
  await call('GET', `/arquivos/${fileA.id}`, s1.token);
  const fileB = await upload(s2.token, 'alheio');
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { arquivoId: fileB.id }, 404);
  const groupFile = await upload(teacher.token, 'anexo-grupo');
  await call('POST', `/mensagens/conversas/${group.id}/mensagens`, teacher.token, { texto: 'Pauta', arquivoId: groupFile.id }, 201);
  await call('GET', `/arquivos/${groupFile.id}`, s2.token);
  await call('GET', `/arquivos/${groupFile.id}`, s1.token);
  await call('GET', `/arquivos/${groupFile.id}`, teacher2.token, null, 404);

  // ------------------------------------------------------------------ canais
  section('canais: visibilidade por perfil');
  const channelsOf = async (user, turmaId = turma.id) => (await call('GET', '/mensagens/canais', user.token)).filter((c) => c.turmaId === turmaId);
  assert.deepEqual((await channelsOf(teacher)).map((c) => c.nome), ['Geral', 'Matemática']);
  assert.deepEqual((await channelsOf(teacher2)).map((c) => c.nome), ['Geral', 'Física']);
  assert.deepEqual((await channelsOf(s1)).map((c) => c.nome).sort(), ['Física', 'Geral', 'Matemática']);
  assert.deepEqual((await channelsOf(tutor)).map((c) => c.nome).sort(), ['Física', 'Geral', 'Matemática']);
  assert.deepEqual(await channelsOf(s3), [], 'quem está em outra turma não vê os canais desta');
  assert.deepEqual((await channelsOf(s3, turmaB.id)).map((c) => c.nome), ['Geral']);
  assert.deepEqual(await call('GET', '/mensagens/canais', outsider.token), []);
  const geralInfo = (await channelsOf(s1)).find((c) => c.id === geral);
  assert.equal(geralInfo.podePublicar, false);
  assert.equal((await channelsOf(teacher)).find((c) => c.id === geral).podePublicar, true);

  section('canais: publicação e leitura');
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, s1.token, { texto: 'Posso?' }, 403);
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, tutor.token, { texto: 'Posso?' }, 403);
  await call('POST', `/mensagens/canais/${matKey}/publicacoes`, teacher2.token, { texto: 'Invasão' }, 404);
  await call('POST', `/mensagens/canais/${turmaB.id}:geral/publicacoes`, teacher.token, { texto: 'Outra turma' }, 404);
  await call('POST', '/mensagens/canais/lixo/publicacoes', teacher.token, { texto: 'Chave ruim' }, 404);
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, teacher.token, { texto: '   ' }, 400);
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, teacher.token, {}, 400);
  const welcome = await call('POST', `/mensagens/canais/${geral}/publicacoes`, teacher.token, { texto: 'Bem-vindos à turma', importante: true }, 201);
  assert.equal(welcome.importante, true);
  assert.equal(welcome.canal, geral);
  assert.equal(welcome.perfilAutor, 'PROFESSOR');
  const exam = await call('POST', `/mensagens/canais/${matKey}/publicacoes`, teacher.token, { texto: 'Prova dia 20' }, 201);
  const byId = (list, id) => list.find((c) => c.id === id);
  assert.equal(byId(await channelsOf(teacher), geral).naoLidas, 0, 'quem publica não tem não lida');
  const s1Channels = await channelsOf(s1);
  assert.equal(byId(s1Channels, geral).naoLidas, 1);
  assert.equal(byId(s1Channels, matKey).naoLidas, 1);
  assert.equal(byId(s1Channels, fisKey).naoLidas, 0);
  assert.equal(byId(s1Channels, matKey).ultima.texto, 'Prova dia 20');
  const summaryBefore = await call('GET', '/mensagens/resumo', s1.token);
  assert.equal(summaryBefore.canais, 2);
  assert.equal(summaryBefore.naoLidas, summaryBefore.canais + summaryBefore.conversas);
  await call('PUT', `/mensagens/canais/${geral}/leitura`, s1.token);
  const afterRead = await channelsOf(s1);
  assert.equal(byId(afterRead, geral).naoLidas, 0);
  assert.equal(byId(afterRead, matKey).naoLidas, 1);
  await call('PUT', `/mensagens/canais/${geral}/leitura`, s3.token, null, 404);
  await call('PUT', `/mensagens/canais/${geral}/leitura`, outsider.token, null, 404);
  await call('PUT', `/mensagens/canais/${geral}/leitura`, admin.token, null, 403);

  section('canais: listagem das publicações');
  const feed = await call('GET', `/mensagens/canais/${geral}/publicacoes`, s1.token);
  assert.equal(feed.itens.length, 1);
  assert.equal(feed.podePublicar, false);
  assert.equal(feed.podeResponder, true);
  assert.equal(feed.itens[0].respostas, 0);
  const tutorFeed = await call('GET', `/mensagens/canais/${geral}/publicacoes`, tutor.token);
  assert.deepEqual([tutorFeed.podePublicar, tutorFeed.podeResponder], [false, false]);
  assert.equal((await call('GET', `/mensagens/canais/${geral}/publicacoes`, teacher.token)).podePublicar, true);
  assert.equal((await call('GET', `/mensagens/canais/${geral}/publicacoes`, teacher2.token)).itens.length, 1);
  await call('GET', `/mensagens/canais/${matKey}/publicacoes`, teacher2.token, null, 404);
  await call('GET', `/mensagens/canais/${geral}/publicacoes`, s3.token, null, 404);
  await call('GET', `/mensagens/canais/${geral}/publicacoes`, outsider.token, null, 404);
  await call('GET', `/mensagens/canais/${geral}/publicacoes`, admin.token, null, 403);
  await call('GET', `/mensagens/canais/${geral}/publicacoes?antes=${exam.id}`, s1.token, null, 400);
  for (let i = 1; i <= 3; i++) await call('POST', `/mensagens/canais/${matKey}/publicacoes`, teacher.token, { texto: `Aviso ${i}` }, 201);
  const posts1 = await call('GET', `/mensagens/canais/${matKey}/publicacoes?limite=2`, s1.token);
  assert.deepEqual(posts1.itens.map((p) => p.texto), ['Aviso 2', 'Aviso 3']);
  assert.equal(posts1.temMais, true);
  const posts2 = await call('GET', `/mensagens/canais/${matKey}/publicacoes?limite=2&antes=${posts1.itens[0].id}`, s1.token);
  assert.deepEqual(posts2.itens.map((p) => p.texto), ['Prova dia 20', 'Aviso 1']);
  assert.equal(posts2.temMais, false);

  section('canais: respostas, fio e curtidas');
  await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, tutor.token, { texto: 'Olá' }, 403);
  await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, s3.token, { texto: 'Olá' }, 404);
  await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, outsider.token, { texto: 'Olá' }, 404);
  await call('POST', `/mensagens/publicacoes/${exam.id}/respostas`, teacher2.token, { texto: 'Olá' }, 404);
  await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, s1.token, { texto: '  ' }, 400);
  await call('POST', `/mensagens/publicacoes/nao-uuid/respostas`, s1.token, { texto: 'Olá' }, 400);
  const answer = await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, s1.token, { texto: 'Obrigado!' }, 201);
  assert.equal(answer.perfilAutor, 'ALUNO');
  assert.equal(byId(await channelsOf(teacher), geral).naoLidas, 1, 'a resposta de outra pessoa conta para o docente');
  assert.equal(byId(await channelsOf(s1), geral).naoLidas, 0, 'a própria resposta não conta');
  const thread = await call('GET', `/mensagens/publicacoes/${welcome.id}`, s2.token);
  assert.equal(thread.publicacao.respostas, 1);
  assert.equal(thread.respostas.length, 1);
  assert.equal(thread.podeResponder, true);
  assert.equal((await call('GET', `/mensagens/publicacoes/${welcome.id}`, tutor.token)).podeResponder, false);
  await call('GET', `/mensagens/publicacoes/${welcome.id}`, s3.token, null, 404);
  await call('GET', `/mensagens/publicacoes/${welcome.id}`, outsider.token, null, 404);
  await call('GET', `/mensagens/publicacoes/${exam.id}`, teacher2.token, null, 404);
  await call('GET', `/mensagens/publicacoes/${welcome.id}`, admin.token, null, 403);
  await call('GET', '/mensagens/publicacoes/nao-uuid', s1.token, null, 400);
  assert.deepEqual(await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'PUBLICACAO', id: welcome.id }, 201), { curtidas: 1, curtidaPorMim: true });
  assert.deepEqual(await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'RESPOSTA', id: answer.id }, 201), { curtidas: 1, curtidaPorMim: true });
  const liveThread = await call('GET', `/mensagens/publicacoes/${welcome.id}`, s2.token);
  assert.deepEqual([liveThread.publicacao.curtidas, liveThread.publicacao.curtidaPorMim], [1, true]);
  assert.deepEqual([liveThread.respostas[0].curtidas, liveThread.respostas[0].curtidaPorMim], [1, true]);
  assert.deepEqual(await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'PUBLICACAO', id: welcome.id }, 201), { curtidas: 0, curtidaPorMim: false });
  await call('POST', '/mensagens/curtidas', s3.token, { tipo: 'PUBLICACAO', id: welcome.id }, 404);
  await call('POST', '/mensagens/curtidas', s3.token, { tipo: 'RESPOSTA', id: answer.id }, 404);
  await call('POST', '/mensagens/curtidas', teacher2.token, { tipo: 'PUBLICACAO', id: exam.id }, 404);
  await call('POST', '/mensagens/curtidas', s2.token, { tipo: 'PUBLICACAO', id: first.id }, 404);

  section('anexos em canais');
  const postFile = await upload(teacher.token, 'material-geral');
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, teacher.token, { texto: 'Material', arquivoId: postFile.id }, 201);
  for (const reader of [s1, s2, tutor, teacher2, teacher]) await call('GET', `/arquivos/${postFile.id}`, reader.token);
  for (const stranger of [s3, outsider]) await call('GET', `/arquivos/${postFile.id}`, stranger.token, null, 404);
  const subjectFile = await upload(teacher.token, 'material-matematica');
  await call('POST', `/mensagens/canais/${matKey}/publicacoes`, teacher.token, { texto: 'Lista', arquivoId: subjectFile.id }, 201);
  await call('GET', `/arquivos/${subjectFile.id}`, s1.token);
  await call('GET', `/arquivos/${subjectFile.id}`, teacher2.token, null, 404);
  const replyFile = await upload(s1.token, 'resposta');
  await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, s1.token, { arquivoId: replyFile.id }, 201);
  await call('GET', `/arquivos/${replyFile.id}`, teacher.token);
  await call('GET', `/arquivos/${replyFile.id}`, s3.token, null, 404);
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, teacher.token, { arquivoId: postFile.id }, 400);

  // ------------------------------------------------------------------ Atividade: turmaId e leitura
  section('atividade: turmaId nos eventos e leitura no servidor');
  const task = await call('POST', '/atividades', teacher.token, { disciplinaId: mat.id, titulo: 'Trabalho', descricao: 'Descrição', prazo: new Date(Date.now() + 86400000).toISOString(), notaMaxima: 10, estado: 'RASCUNHO' }, 201);
  await call('POST', `/atividades/${task.id}/publicar`, teacher.token, null, 201);
  const notices = await call('GET', '/academico/avisos', s1.token);
  const taskEvent = notices.itens.find((event) => event.tipo === 'ATIVIDADE' && event.recursoId === task.id);
  assert.ok(taskEvent, 'o aviso da atividade publicada aparece');
  assert.equal(taskEvent.turmaId, turma.id);
  assert.equal(taskEvent.disciplinaId, mat.id);
  await call('GET', '/academico/avisos/leitura', null, null, 401);
  await call('GET', '/academico/avisos/leitura', secretaria.token, null, 403);
  assert.deepEqual(await call('GET', '/academico/avisos/leitura', s1.token), { lidoAte: null });
  const stamp = await call('PUT', '/academico/avisos/leitura', s1.token, {});
  assert.ok(Math.abs(Date.parse(stamp.lidoAte) - Date.now()) < 60_000);
  assert.deepEqual(await call('GET', '/academico/avisos/leitura', s1.token), stamp);
  const older = new Date(Date.parse(stamp.lidoAte) - 3_600_000).toISOString();
  assert.deepEqual(await call('PUT', '/academico/avisos/leitura', s1.token, { ate: older }), stamp, 'a leitura nunca recua');
  const future = await call('PUT', '/academico/avisos/leitura', s1.token, { ate: new Date(Date.now() + 86_400_000).toISOString() });
  assert.ok(Date.parse(future.lidoAte) <= Date.now(), 'a leitura nunca passa de agora');
  await call('PUT', '/academico/avisos/leitura', s1.token, { ate: 'lixo' }, 400);
  await call('PUT', '/academico/avisos/leitura', s1.token, { outro: 1 }, 400);
  assert.deepEqual(await call('GET', '/academico/avisos/leitura', s2.token), { lidoAte: null }, 'cada pessoa tem o seu estado');
  const pastStamp = new Date(Date.now() - 7_200_000).toISOString();
  assert.equal((await call('PUT', '/academico/avisos/leitura', s2.token, { ate: pastStamp })).lidoAte, pastStamp);

  // ------------------------------------------------------------------ turma fechada
  section('turma fechada');
  await call('PATCH', `/turmas/${turma.id}/fechamento`, admin.token, { fechada: true });
  await call('POST', `/mensagens/canais/${geral}/publicacoes`, teacher.token, { texto: 'Depois do fechamento' }, 403);
  await call('POST', `/mensagens/publicacoes/${welcome.id}/respostas`, s1.token, { texto: 'Depois do fechamento' }, 403);
  await call('POST', '/mensagens/conversas', s1.token, { participanteIds: [teacher2.id] }, 403);
  assert.equal((await channelsOf(teacher)).find((c) => c.id === geral).podePublicar, false);
  assert.equal((await call('GET', `/mensagens/canais/${geral}/publicacoes`, s1.token)).podeResponder, false);
  assert.ok((await call('GET', `/mensagens/canais/${geral}/publicacoes`, s1.token)).itens.length >= 2, 'a leitura continua');
  await call('POST', `/mensagens/conversas/${direct.id}/mensagens`, s1.token, { texto: 'A conversa existente continua' }, 201);
  await call('PATCH', `/turmas/${turma.id}/fechamento`, admin.token, { fechada: false });

  // ------------------------------------------------------------------ auditoria e banco
  section('auditoria e restrições do banco');
  assert.equal(await db.auditoria.count({ where: { autorId: s1.id, acao: 'CRIAR_CONVERSA' } }), 2);
  assert.ok((await db.auditoria.count({ where: { autorId: teacher.id, acao: 'PUBLICAR_CANAL' } })) >= 6);
  assert.equal(await db.auditoria.count({ where: { autorId: s2.id, acao: 'CRIAR_CONVERSA' } }) >= 1, true);
  await assert.rejects(db.mensagem.create({ data: { instituicaoId: tenants[0], conversaId: direct.id, autorId: s1.id, texto: '   ' } }), 'mensagem sem texto nem anexo viola a restrição');
  await assert.rejects(db.publicacao.create({ data: { instituicaoId: tenants[0], turmaId: turma.id, autorId: teacher.id, texto: ' ' } }), 'publicação sem texto viola a restrição');
  await assert.rejects(db.conversa.create({ data: { instituicaoId: tenants[0], tipo: 'DIRETA', chaveDireta: [s1.id, s2.id].sort().join(':'), criadaPorId: s1.id } }), 'par duplicado viola a unicidade');
  await assert.rejects(db.conversa.create({ data: { instituicaoId: tenants[0], tipo: 'GRUPO', criadaPorId: s1.id } }), 'grupo sem título viola a restrição');
  await assert.rejects(db.mensagem.create({ data: { instituicaoId: tenants[1], conversaId: direct.id, autorId: outsider.id, texto: 'cruzando instituições' } }), 'a chave composta impede misturar instituições');
  console.log(`${checks} verificações HTTP e de banco concluídas`);
}

main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; }).finally(async () => {
  try {
    const ownedFiles = [];
    if (testUserIds.length) await db.$transaction(async (tx) => {
      const turmas = await tx.turma.findMany({ where: { instituicaoId: { in: tenants }, nome: { in: Object.values(classNames) }, periodo: '2026/2' }, select: { id: true } });
      const turmaIds = turmas.map(({ id }) => id);
      const disciplinas = await tx.disciplina.findMany({ where: { instituicaoId: { in: tenants }, turmaId: { in: turmaIds } }, select: { id: true } });
      const disciplinaIds = disciplinas.map(({ id }) => id);
      const matriculas = await tx.matricula.findMany({ where: { instituicaoId: tenants[0], alunoId: { in: testUserIds } }, select: { id: true } });
      const matriculaIds = matriculas.map(({ id }) => id);
      const atividades = await tx.atividade.findMany({ where: { instituicaoId: tenants[0], disciplinaId: { in: disciplinaIds } }, select: { id: true } });
      const atividadeIds = atividades.map(({ id }) => id);
      const files = await tx.arquivo.findMany({ where: { autorId: { in: testUserIds } }, select: { id: true } });
      const fileIds = files.map(({ id }) => id);
      ownedFiles.push(...fileIds);
      // Mensagens primeiro: apontam para usuários, turmas e arquivos.
      const conversas = await tx.conversa.findMany({ where: { criadaPorId: { in: testUserIds } }, select: { id: true } });
      const conversaIds = conversas.map(({ id }) => id);
      const publicacoes = await tx.publicacao.findMany({ where: { OR: [{ turmaId: { in: turmaIds } }, { autorId: { in: testUserIds } }] }, select: { id: true } });
      const publicacaoIds = publicacoes.map(({ id }) => id);
      const mensagens = await tx.mensagem.findMany({ where: { OR: [{ conversaId: { in: conversaIds } }, { autorId: { in: testUserIds } }] }, select: { id: true } });
      const mensagemIds = mensagens.map(({ id }) => id);
      const respostas = await tx.respostaPublicacao.findMany({ where: { OR: [{ publicacaoId: { in: publicacaoIds } }, { autorId: { in: testUserIds } }] }, select: { id: true } });
      const respostaIds = respostas.map(({ id }) => id);
      await tx.curtidaMensagem.deleteMany({ where: { OR: [{ mensagemId: { in: mensagemIds } }, { usuarioId: { in: testUserIds } }] } });
      await tx.curtidaPublicacao.deleteMany({ where: { OR: [{ publicacaoId: { in: publicacaoIds } }, { usuarioId: { in: testUserIds } }] } });
      await tx.curtidaResposta.deleteMany({ where: { OR: [{ respostaId: { in: respostaIds } }, { usuarioId: { in: testUserIds } }] } });
      await tx.respostaPublicacao.deleteMany({ where: { id: { in: respostaIds } } });
      await tx.publicacao.deleteMany({ where: { id: { in: publicacaoIds } } });
      await tx.mensagem.deleteMany({ where: { id: { in: mensagemIds } } });
      await tx.conversaParticipante.deleteMany({ where: { OR: [{ conversaId: { in: conversaIds } }, { usuarioId: { in: testUserIds } }] } });
      await tx.conversa.deleteMany({ where: { id: { in: conversaIds } } });
      await tx.leituraCanal.deleteMany({ where: { usuarioId: { in: testUserIds } } });
      await tx.leituraAvisos.deleteMany({ where: { usuarioId: { in: testUserIds } } });
      // Cadastro acadêmico, como no teste acadêmico.
      await tx.entrega.deleteMany({ where: { OR: [{ matriculaId: { in: matriculaIds } }, { atividadeId: { in: atividadeIds } }, { arquivoId: { in: fileIds } }] } });
      await tx.material.deleteMany({ where: { OR: [{ disciplinaId: { in: disciplinaIds } }, { arquivoId: { in: fileIds } }] } });
      await tx.perfilMl.deleteMany({ where: { matriculaId: { in: matriculaIds } } });
      await tx.atividade.deleteMany({ where: { id: { in: atividadeIds } } });
      await tx.tutoria.deleteMany({ where: { matriculaId: { in: matriculaIds } } });
      await tx.lotacao.deleteMany({ where: { disciplinaId: { in: disciplinaIds } } });
      await tx.matricula.deleteMany({ where: { id: { in: matriculaIds } } });
      await tx.disciplina.deleteMany({ where: { id: { in: disciplinaIds } } });
      await tx.turma.deleteMany({ where: { id: { in: turmaIds } } });
      await tx.arquivo.deleteMany({ where: { id: { in: fileIds } } });
      await tx.auditoria.deleteMany({ where: { autorId: { in: testUserIds } } });
      await tx.sessao.deleteMany({ where: { usuarioId: { in: testUserIds } } });
      await tx.usuario.deleteMany({ where: { id: { in: testUserIds } } });
    }, { timeout: 30000 });
    const directory = process.env.TEST_UPLOAD_DIR;
    if (directory) for (const id of new Set([...uploaded, ...ownedFiles])) {
      if (/^[0-9a-f-]{36}$/.test(id)) rmSync(resolve(directory, id), { force: true });
    }
  } catch (error) {
    console.error(`Falha na limpeza dos registros do teste: ${error.message}`);
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
