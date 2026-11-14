// Teste de integração da gestão de contas: editar, desativar/reativar, redefinir senha e cadastro em lote.
// Usa duas Fatecs do catálogo e remove somente o que cria. Rode após build + migração, com API e banco locais.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { Workbook } = require('exceljs');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const dbUrl = new URL(process.env.DATABASE_URL);
if (dbUrl.hostname === 'db' && process.env.TEST_DB_IN_NETWORK !== 'true') dbUrl.hostname = '127.0.0.1';
assert.ok(
  ['localhost', '127.0.0.1'].includes(dbUrl.hostname) || (dbUrl.hostname === 'db' && process.env.TEST_DB_IN_NETWORK === 'true'),
  'Teste permitido somente em banco local',
);
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString() }) });

const tag = randomUUID().slice(0, 8);
const tenants = [];
const testUserIds = [];
let checks = 0;

async function call(method, path, token, body, expected = 200, attempt = 0) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
  });
  // Limitador por rota e IP (login 5/min, importação 10/min): espera o indicado e repete.
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

const section = (title) => console.log(`- ${title}`);
const login = (user, senha, expected = 200) => call('POST', '/auth/login', null, { instituicaoId: user.instituicaoId, email: user.email, senha }, expected);

async function workbook(rows, name = 'Importacao') {
  const book = new Workbook();
  const sheet = book.addWorksheet(name);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}
const upload = (bytes, filename = 'planilha.xlsx') => {
  const form = new FormData();
  form.append('arquivo', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  return form;
};
const importPath = (perfil = 'ALUNO', simular = false) => `/usuarios/importacoes?perfil=${perfil}${simular ? '&simular=true' : ''}`;
const STUDENT_HEADER = ['Registro (matrícula)', 'Nome do aluno', 'E-mail do aluno', 'Turma', 'Curso da turma', 'Período da turma'];

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
    ['teacher', 'PROFESSOR', 0, 'Prof Existente'],
    ['s1', 'ALUNO', 0, 'Aluno Um'],
    ['s2', 'ALUNO', 0, 'Aluno Dois'],
    ['s3', 'ALUNO', 0, 'Aluno Tres'],
    ['outAdmin', 'COORDENACAO', 1, 'Coordenação Outra Fatec'],
  ];
  const who = {};
  for (const [key, perfil, tenant, nome] of roster) {
    who[key] = await db.usuario.create({ data: { instituicaoId: tenants[tenant], email: `${key.toLowerCase()}.${tag}@example.test`, nome, senhaHash, perfil } });
    testUserIds.push(who[key].id);
  }
  const { admin, secretaria, teacher, s1, s2, s3, outAdmin } = who;
  for (const key of ['admin', 'secretaria', 'outAdmin', 's1', 's2']) {
    who[key].token = (await login(who[key], senha)).accessToken;
  }

  // ------------------------------------------------------------------ editar
  section('editar pessoa');
  const renamed = await call('PATCH', `/usuarios/${s1.id}`, admin.token, { nome: 'Aluno Um Editado', email: `S1.Novo.${tag}@Example.test` });
  assert.equal(renamed.nome, 'Aluno Um Editado');
  assert.equal(renamed.email, `s1.novo.${tag}@example.test`, 'e-mail guardado em minúsculas');
  assert.equal(renamed.senhaHash, undefined);
  who.s1.email = renamed.email;
  await call('PATCH', `/usuarios/${s1.id}`, admin.token, { email: s2.email }, 409);
  for (const bad of [{}, { foo: 1 }, { email: 'nao-e-email' }, { nome: 'A' }, { ativo: 'sim' }]) {
    await call('PATCH', `/usuarios/${s1.id}`, admin.token, bad, 400);
  }
  await call('PATCH', '/usuarios/nao-uuid', admin.token, { nome: 'Nome Valido' }, 400);
  assert.equal((await call('PATCH', `/usuarios/${s2.id}`, secretaria.token, { nome: 'Aluno Dois Editado' })).nome, 'Aluno Dois Editado');
  await call('PATCH', `/usuarios/${teacher.id}`, secretaria.token, { nome: 'Invasão' }, 404);
  assert.equal((await call('PATCH', `/usuarios/${teacher.id}`, admin.token, { nome: 'Prof Existente Editado' })).nome, 'Prof Existente Editado');
  who.teacher.nome = 'Prof Existente Editado';
  await call('PATCH', `/usuarios/${s1.id}`, outAdmin.token, { nome: 'Outra Fatec' }, 404);
  await call('PATCH', `/usuarios/${s1.id}`, who.s1.token, { nome: 'Eu mesmo' }, 403);
  await call('PATCH', `/usuarios/${s1.id}`, null, { nome: 'Sem login' }, 401);
  await call('PATCH', `/usuarios/${admin.id}`, admin.token, { ativo: false }, 400);

  // ------------------------------------------------------------------ desativar / reativar
  section('desativar e reativar');
  await call('GET', '/auth/me', who.s1.token);
  const off = await call('PATCH', `/usuarios/${s1.id}`, admin.token, { ativo: false });
  assert.equal(off.ativo, false);
  await call('GET', '/auth/me', who.s1.token, null, 401);
  await login(who.s1, senha, 401);
  assert.equal((await db.sessao.count({ where: { usuarioId: s1.id, revogadaEm: null } })), 0, 'sessões revogadas');
  await call('POST', `/usuarios/${s1.id}/redefinir-senha`, admin.token, null, 409);
  assert.equal((await call('PATCH', `/usuarios/${s1.id}`, admin.token, { ativo: true })).ativo, true);
  const back = await login(who.s1, senha);
  assert.ok(back.accessToken);
  who.s1.token = back.accessToken;
  await call('GET', '/auth/me', who.s1.token);

  // ------------------------------------------------------------------ redefinir senha
  section('redefinir senha');
  const reset = await call('POST', `/usuarios/${s2.id}/redefinir-senha`, admin.token, null, 200);
  assert.equal(reset.senhaTemporaria.length, 14);
  assert.equal(reset.email, s2.email);
  await call('GET', '/auth/me', who.s2.token, null, 401);
  const temp = await login(s2, reset.senhaTemporaria);
  const me = await call('GET', '/auth/me', temp.accessToken);
  assert.equal(me.trocaSenhaObrigatoria, true);
  await call('GET', '/academico/avisos', temp.accessToken, null, 403);
  const novaSenha = `Nova-${randomUUID()}`;
  await call('POST', '/auth/trocar-senha', temp.accessToken, { senhaAtual: reset.senhaTemporaria, novaSenha }, 204);
  await call('GET', '/academico/avisos', temp.accessToken);
  await call('POST', `/usuarios/${admin.id}/redefinir-senha`, admin.token, null, 400);
  await call('POST', `/usuarios/${teacher.id}/redefinir-senha`, secretaria.token, null, 404);
  assert.equal((await call('POST', `/usuarios/${s3.id}/redefinir-senha`, secretaria.token, null, 200)).senhaTemporaria.length, 14);
  await call('POST', `/usuarios/${s3.id}/redefinir-senha`, who.s1.token, null, 403);
  await call('POST', `/usuarios/${s1.id}/redefinir-senha`, outAdmin.token, null, 404);
  await call('POST', `/usuarios/${s1.id}/redefinir-senha`, null, null, 401);

  const audit = (acao, recursoId) => db.auditoria.count({ where: { acao, recursoId, instituicaoId: tenants[0] } });
  assert.equal(await audit('DESATIVAR_USUARIO', s1.id), 1);
  assert.equal(await audit('REATIVAR_USUARIO', s1.id), 1);
  assert.ok((await audit('ATUALIZAR_USUARIO', s1.id)) >= 1);
  assert.equal(await audit('REDEFINIR_SENHA', s2.id), 1);

  // ------------------------------------------------------------------ importação: modelo e permissões
  section('importação: modelo e permissões');
  for (const perfil of ['ALUNO', 'PROFESSOR']) {
    const bytes = await call('GET', `/usuarios/importacoes/modelo?perfil=${perfil}`, admin.token);
    assert.equal(Buffer.from(bytes).subarray(0, 2).toString(), 'PK', 'o modelo é um XLSX');
  }
  await call('GET', '/usuarios/importacoes/modelo?perfil=ALUNO', secretaria.token);
  await call('GET', '/usuarios/importacoes/modelo?perfil=PROFESSOR', secretaria.token, null, 403);
  await call('GET', '/usuarios/importacoes/modelo?perfil=OUTRO', admin.token, null, 400);
  await call('GET', '/usuarios/importacoes/modelo', who.s1.token, null, 403);
  await call('GET', '/usuarios/importacoes/modelo', null, null, 401);

  const turma = await call('POST', '/turmas', admin.token, { nome: `Turma Import ${tag}`, curso: 'Curso Teste', periodo: '2026/2' }, 201);
  const closed = await call('POST', '/turmas', admin.token, { nome: `Turma Fechada ${tag}`, curso: 'Curso Teste', periodo: '2026/2' }, 201);
  await call('PATCH', `/turmas/${closed.id}/fechamento`, admin.token, { fechada: true });
  const turmaCols = [turma.nome, 'Curso Teste', '2026/2'];
  const email = (name) => `${name}.${tag}@example.test`;

  // ------------------------------------------------------------------ importação de alunos
  section('importação de alunos no formato da planilha de previsões');
  const sheetRows = [
    // Colunas extras da planilha do importador de previsões: devem ser ignoradas.
    [...STUDENT_HEADER, 'Disciplina', 'E-mail do professor', 'Versão do perfil', 'Estado civil'],
    [`REG-${tag}-1`, 'Aluno Importado Um', email('imp1'), ...turmaCols, 'Disciplina X', 'prof@example.test', 0, 'Solteiro(a)'],
    [`REG-${tag}-2`, 'Aluno Importado Dois', email('imp2'), ...turmaCols, 'Disciplina X', 'prof@example.test', 0, 'Solteiro(a)'],
    [`REG-${tag}-3`, s3.nome, s3.email, ...turmaCols, 'Disciplina X', 'prof@example.test', 0, 'Solteiro(a)'],
  ];
  const sheet = await workbook(sheetRows);
  const dry = await call('POST', importPath('ALUNO', true), admin.token, upload(sheet));
  assert.deepEqual(dry, { simulacao: true, resumo: { linhas: 3, usuariosNovos: 2, usuariosExistentes: 1, matriculasNovas: 3, matriculasExistentes: 0 }, credenciais: [] });
  assert.equal(await db.usuario.count({ where: { email: { contains: `imp1.${tag}` } } }), 0, 'a simulação não grava nada');

  const done = await call('POST', importPath('ALUNO'), admin.token, upload(sheet));
  assert.equal(done.simulacao, false);
  assert.deepEqual(done.resumo, dry.resumo);
  assert.equal(done.credenciais.length, 2);
  for (const item of done.credenciais) {
    assert.equal(item.senhaTemporaria.length, 14);
    assert.match(item.registro, /^REG-/);
  }
  assert.notEqual(done.credenciais[0].senhaTemporaria, done.credenciais[1].senhaTemporaria, 'cada conta tem senha própria');
  const imported = await db.usuario.findMany({ where: { email: { in: [email('imp1'), email('imp2')] } } });
  assert.equal(imported.length, 2);
  assert.ok(imported.every((user) => user.perfil === 'ALUNO' && user.trocaSenhaObrigatoria && user.ativo));
  assert.ok(imported.every((user) => !user.senhaHash.includes('Fatec@123')));
  testUserIds.push(...imported.map((user) => user.id));
  assert.equal(await db.matricula.count({ where: { turmaId: turma.id } }), 3);
  assert.equal(await db.auditoria.count({ where: { autorId: admin.id, acao: 'IMPORTAR_USUARIO' } }), 2);
  const first = done.credenciais.find((item) => item.email === email('imp1'));
  const firstLogin = await login({ instituicaoId: tenants[0], email: first.email }, first.senhaTemporaria);
  assert.equal((await call('GET', '/auth/me', firstLogin.accessToken)).trocaSenhaObrigatoria, true);

  const again = await call('POST', importPath('ALUNO'), admin.token, upload(sheet));
  assert.deepEqual(again.resumo, { linhas: 3, usuariosNovos: 0, usuariosExistentes: 3, matriculasNovas: 0, matriculasExistentes: 3 });
  assert.deepEqual(again.credenciais, [], 'reimportar não gera senhas nem duplica');
  assert.equal(await db.matricula.count({ where: { turmaId: turma.id } }), 3);

  section('importação: erros listados por linha, sem gravar nada');
  const before = await db.usuario.count();
  const bad = await workbook([
    STUDENT_HEADER,
    [`REG-${tag}-9`, 'Erro Um', email('err1'), 'Turma que não existe', 'Curso Teste', '2026/2'],
    [`REG-${tag}-8`, 'Erro Dois', email('err2'), `Turma Fechada ${tag}`, 'Curso Teste', '2026/2'],
    [`REG-${tag}-7`, 'Erro Tres', teacher.email, ...turmaCols],
    [`REG-${tag}-6`, 'Nome Diferente', email('imp1'), ...turmaCols],
    [`REG-${tag}-1`, 'Erro Cinco', email('err5'), ...turmaCols],
    [`REG-${tag}-5`, 'Erro Seis', 'isso-nao-e-email', ...turmaCols],
  ]);
  const failed = await call('POST', importPath(), admin.token, upload(bad), 400);
  const lines = failed.message;
  assert.ok(Array.isArray(lines));
  assert.match(lines[0], /^A planilha tem 6 problema\(s\)\. Nada foi importado\.$/);
  const numbers = lines.slice(1).map((line) => Number(/^Linha (\d+)/.exec(line)[1]));
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), 'problemas listados na ordem da planilha');
  for (const expectation of [/^Linha 2: turma "Turma que não existe"/, /^Linha 3: a turma ".*" está fechada/, /^Linha 4: este e-mail já pertence a outro perfil/, /^Linha 5: e-mail já cadastrado com outro nome/, /^Linha 6: o registro REG-.* já pertence a outro aluno ou turma/, /^Linha 7: e-mail inválido/]) {
    assert.ok(lines.some((line) => expectation.test(line)), `esperava ${expectation} em ${JSON.stringify(lines)}`);
  }
  assert.equal(await db.usuario.count(), before, 'com erro, nada é gravado');

  section('importação: outras regras');
  const isolated = await call('POST', importPath(), outAdmin.token, upload(await workbook([STUDENT_HEADER, [`REG-${tag}-X`, 'Isolado', email('iso'), ...turmaCols]])), 400);
  assert.ok(isolated.message.some((line) => /não existe nesta instituição/.test(line)));
  assert.equal(await db.usuario.count({ where: { email: email('iso') } }), 0, 'isolamento entre Fatecs');
  await call('POST', importPath(), who.s1.token, upload(sheet), 403);
  await call('POST', importPath(), null, upload(sheet), 401);
  await call('POST', importPath(), admin.token, null, 400);
  await call('POST', importPath(), admin.token, upload(Buffer.from('a;b\n1;2'), 'dados.xlsx'), 400);
  await call('POST', importPath(), admin.token, upload(sheet, 'dados.csv'), 400);
  const tooMany = await workbook([STUDENT_HEADER, ...Array.from({ length: 201 }, (_, i) => [`R-${tag}-${i}`, `Pessoa ${i}`, email(`many${i}`), ...turmaCols])]);
  await call('POST', importPath(), admin.token, upload(tooMany), 400);
  await call('POST', importPath('OUTRO'), admin.token, upload(sheet), 400);

  section('importação de professores e papel da secretaria');
  const teachers = await workbook([['Nome do professor', 'E-mail do professor'], ['Prof Importado', email('profimp')]]);
  const teacherImport = await call('POST', importPath('PROFESSOR'), admin.token, upload(teachers));
  assert.equal(teacherImport.resumo.usuariosNovos, 1);
  assert.equal(teacherImport.credenciais.length, 1);
  const createdTeacher = await db.usuario.findFirst({ where: { email: email('profimp') } });
  assert.equal(createdTeacher.perfil, 'PROFESSOR');
  testUserIds.push(createdTeacher.id);
  await call('POST', importPath('PROFESSOR'), secretaria.token, upload(await workbook([['Nome do professor', 'E-mail do professor'], ['Outro Prof', email('profsec')]])), 403);
  assert.equal(await db.usuario.count({ where: { email: email('profsec') } }), 0);
  const bySecretary = await call('POST', importPath('ALUNO'), secretaria.token, upload(await workbook([STUDENT_HEADER, [`REG-${tag}-S`, 'Aluno Da Secretaria', email('imps'), ...turmaCols]])));
  assert.equal(bySecretary.credenciais.length, 1);
  const bySecretaryUser = await db.usuario.findFirst({ where: { email: email('imps') } });
  testUserIds.push(bySecretaryUser.id);
  const accountOnly = await call('POST', importPath('ALUNO'), admin.token, upload(await workbook([STUDENT_HEADER, [null, 'Somente Conta', email('conta'), null, null, null]])));
  assert.deepEqual([accountOnly.resumo.usuariosNovos, accountOnly.resumo.matriculasNovas], [1, 0]);
  testUserIds.push((await db.usuario.findFirst({ where: { email: email('conta') } })).id);
  console.log(`${checks} verificações concluídas`);
}

main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; }).finally(async () => {
  try {
    const extra = await db.usuario.findMany({ where: { instituicaoId: { in: tenants }, email: { contains: `.${tag}@` } }, select: { id: true } });
    const ids = [...new Set([...testUserIds, ...extra.map(({ id }) => id)])];
    if (ids.length) await db.$transaction(async (tx) => {
      const turmas = await tx.turma.findMany({ where: { instituicaoId: { in: tenants }, nome: { in: [`Turma Import ${tag}`, `Turma Fechada ${tag}`] } }, select: { id: true } });
      await tx.matricula.deleteMany({ where: { OR: [{ alunoId: { in: ids } }, { turmaId: { in: turmas.map(({ id }) => id) } }] } });
      await tx.turma.deleteMany({ where: { id: { in: turmas.map(({ id }) => id) } } });
      await tx.auditoria.deleteMany({ where: { OR: [{ autorId: { in: ids } }, { recursoId: { in: ids } }] } });
      await tx.sessao.deleteMany({ where: { usuarioId: { in: ids } } });
      await tx.usuario.deleteMany({ where: { id: { in: ids } } });
    }, { timeout: 30000 });
  } catch (error) {
    console.error(`Falha na limpeza dos registros do teste: ${error.message}`);
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
