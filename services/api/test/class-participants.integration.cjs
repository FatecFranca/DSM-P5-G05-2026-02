// Teste de integração dos participantes da turma e dos desvínculos (matrícula, docente, tutor), mais o
// cadastro manual com senha temporária. Usa duas Fatecs do catálogo e remove somente o que cria.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');
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
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
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
    ['tutor2', 'TUTOR', 0, 'Outro Tutor'],
    ['s1', 'ALUNO', 0, 'Ana Aluna'],
    ['s2', 'ALUNO', 0, 'Beto Aluno'],
    ['s3', 'ALUNO', 0, 'Caio Sem Turma'],
    ['outAdmin', 'COORDENACAO', 1, 'Coordenação Outra Fatec'],
  ];
  const who = {};
  for (const [key, perfil, tenant, nome] of roster) {
    who[key] = await db.usuario.create({ data: { instituicaoId: tenants[tenant], email: `${key.toLowerCase()}.${tag}@example.test`, nome, senhaHash, perfil } });
    testUserIds.push(who[key].id);
  }
  // Login só de quem precisa de token (o login limita 5 por minuto).
  for (const key of ['admin', 'secretaria', 'teacher', 'teacher2', 'tutor', 's1', 'outAdmin']) {
    who[key].token = (await login(who[key], senha)).accessToken;
  }
  const { admin, secretaria, teacher, teacher2, tutor, tutor2, s1, s2, s3, outAdmin } = who;

  // ------------------------------------------------------------------ montar a turma pelas rotas
  section('montar a turma: disciplinas, docentes, matrículas e tutoria');
  const turma = await call('POST', '/turmas', admin.token, { nome: `Turma Participantes ${tag}`, curso: 'Curso Teste', periodo: '2026/2' }, 201);
  const mat = await call('POST', '/disciplinas', admin.token, { turmaId: turma.id, nome: 'Matemática' }, 201);
  const fis = await call('POST', '/disciplinas', admin.token, { turmaId: turma.id, nome: 'Física' }, 201);
  await call('POST', '/lotacoes', admin.token, { disciplinaId: mat.id, professorId: teacher.id }, 201);
  await call('POST', '/lotacoes', admin.token, { disciplinaId: fis.id, professorId: teacher2.id }, 201);
  await call('POST', '/lotacoes', admin.token, { disciplinaId: fis.id, professorId: teacher.id }, 201);
  const m1 = await call('POST', '/matriculas', secretaria.token, { turmaId: turma.id, alunoId: s1.id, registro: `P1-${tag}` }, 201);
  const m2 = await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: s2.id, registro: `P2-${tag}` }, 201);
  await call('POST', '/tutorias', admin.token, { matriculaId: m1.id, tutorId: tutor.id }, 201);
  await call('POST', '/tutorias', admin.token, { matriculaId: m1.id, tutorId: teacher.id }, 404);

  // ------------------------------------------------------------------ participantes
  section('participantes: o que cada perfil enxerga');
  const path = `/turmas/${turma.id}/participantes`;
  const full = await call('GET', path, admin.token);
  assert.equal(full.turma.id, turma.id);
  assert.deepEqual(full.disciplinas.map((d) => d.nome), ['Física', 'Matemática'], 'disciplinas em ordem alfabética');
  const fisica = full.disciplinas.find((d) => d.nome === 'Física');
  assert.deepEqual(fisica.docentes.map((d) => d.nome), ['Prof Física', 'Prof Matemática'], 'docentes por disciplina, em ordem');
  assert.deepEqual(full.disciplinas.find((d) => d.nome === 'Matemática').docentes.map((d) => d.id), [teacher.id]);
  assert.deepEqual(full.estudantes.map((e) => e.aluno.nome), ['Ana Aluna', 'Beto Aluno']);
  assert.equal(full.estudantes[0].registro, `P1-${tag}`);
  assert.deepEqual(full.estudantes[0].tutores.map((t) => t.nome), ['Tutor Teste']);
  assert.deepEqual(full.estudantes[1].tutores, []);
  assert.equal(full.estudantes[0].aluno.email, s1.email);
  assert.equal(full.estudantes[0].aluno.senhaHash, undefined);
  assert.deepEqual(full.permissoes, { criarDisciplina: true, vincularDocente: true, vincularTutor: true, matricular: true, removerMatricula: true });

  const bySecretary = await call('GET', path, secretaria.token);
  assert.deepEqual(bySecretary.permissoes, { criarDisciplina: false, vincularDocente: false, vincularTutor: false, matricular: true, removerMatricula: true });
  const byTeacher = await call('GET', path, teacher.token);
  assert.equal(byTeacher.estudantes.length, 2);
  assert.ok(Object.values(byTeacher.permissoes).every((value) => value === false), 'docente só lê');
  const byTutor = await call('GET', path, tutor.token);
  assert.deepEqual(byTutor.estudantes.map((e) => e.aluno.nome), ['Ana Aluna'], 'tutor vê só quem acompanha');
  assert.ok(Object.values(byTutor.permissoes).every((value) => value === false));
  await call('GET', path, teacher2.token);
  await call('GET', path, s1.token, null, 403);
  await call('GET', path, outAdmin.token, null, 404);
  await call('GET', path, null, null, 401);
  await call('GET', `/turmas/${randomUUID()}/participantes`, admin.token, null, 404);
  await call('GET', '/turmas/nao-uuid/participantes', admin.token, null, 400);
  const otherTurma = await call('POST', '/turmas', admin.token, { nome: `Turma Alheia ${tag}`, curso: 'Curso Teste', periodo: '2026/2' }, 201);
  await call('GET', `/turmas/${otherTurma.id}/participantes`, teacher.token, null, 404);
  await call('GET', `/turmas/${otherTurma.id}/participantes`, tutor.token, null, 404);

  // ------------------------------------------------------------------ desvincular
  section('desvincular docente e tutor');
  await call('DELETE', `/lotacoes/${fis.id}/${teacher2.id}`, secretaria.token, null, 403);
  await call('DELETE', `/lotacoes/${fis.id}/${teacher2.id}`, teacher.token, null, 403);
  await call('DELETE', `/lotacoes/${fis.id}/${teacher2.id}`, outAdmin.token, null, 404);
  await call('DELETE', `/lotacoes/${fis.id}/${teacher2.id}`, admin.token, null, 204);
  await call('DELETE', `/lotacoes/${fis.id}/${teacher2.id}`, admin.token, null, 404);
  await call('DELETE', `/lotacoes/${fis.id}/${randomUUID()}`, admin.token, null, 404);
  await call('GET', path, teacher2.token, null, 404);
  assert.deepEqual((await call('GET', path, admin.token)).disciplinas.find((d) => d.nome === 'Física').docentes.map((d) => d.id), [teacher.id]);
  await call('DELETE', `/tutorias/${m1.id}/${tutor2.id}`, admin.token, null, 404);
  await call('DELETE', `/tutorias/${m1.id}/${tutor.id}`, secretaria.token, null, 403);
  await call('DELETE', `/tutorias/${m1.id}/${tutor.id}`, admin.token, null, 204);
  await call('GET', path, tutor.token, null, 404);
  assert.deepEqual((await call('GET', path, admin.token)).estudantes[0].tutores, []);

  // ------------------------------------------------------------------ remover matrícula
  section('remover matrícula: só sem registros');
  await call('DELETE', `/matriculas/${m1.id}`, teacher.token, null, 403);
  await call('DELETE', `/matriculas/${m1.id}`, s1.token, null, 403);
  await call('DELETE', `/matriculas/${m1.id}`, outAdmin.token, null, 404);
  await call('DELETE', `/matriculas/${randomUUID()}`, admin.token, null, 404);
  const aula = await call('POST', '/aulas', teacher.token, { disciplinaId: mat.id, data: new Date().toISOString(), tema: 'Aula de teste' }, 201);
  await call('PUT', `/aulas/${aula.id}/frequencia`, teacher.token, { itens: [{ matriculaId: m1.id, situacao: 'PRESENTE' }] });
  const blocked = await call('DELETE', `/matriculas/${m1.id}`, admin.token, null, 409);
  assert.match(blocked.message, /já tem registros/);
  assert.equal(await db.matricula.count({ where: { id: m1.id } }), 1, 'matrícula com presença continua');
  await call('POST', '/tutorias', admin.token, { matriculaId: m2.id, tutorId: tutor.id }, 201);
  await call('DELETE', `/matriculas/${m2.id}`, secretaria.token, null, 204);
  assert.equal(await db.matricula.count({ where: { id: m2.id } }), 0);
  assert.equal(await db.tutoria.count({ where: { matriculaId: m2.id } }), 0, 'a tutoria vai junto');
  assert.deepEqual((await call('GET', path, admin.token)).estudantes.map((e) => e.aluno.nome), ['Ana Aluna']);
  assert.equal(await db.usuario.count({ where: { id: s2.id } }), 1, 'a conta do estudante fica');
  const m2again = await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: s2.id, registro: `P2-${tag}` }, 201);
  await call('DELETE', `/matriculas/${m2again.id}`, admin.token, null, 204);

  section('período fechado trava os vínculos');
  const m3 = await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: s3.id, registro: `P3-${tag}` }, 201);
  await call('PATCH', `/turmas/${turma.id}/fechamento`, admin.token, { fechada: true });
  const closed = await call('GET', path, admin.token);
  assert.ok(Object.values(closed.permissoes).every((value) => value === false), 'turma fechada: nenhuma alteração de vínculo');
  await call('DELETE', `/matriculas/${m3.id}`, admin.token, null, 403);
  await call('DELETE', `/lotacoes/${mat.id}/${teacher.id}`, admin.token, null, 403);
  await call('PATCH', `/turmas/${turma.id}/fechamento`, admin.token, { fechada: false });
  await call('DELETE', `/matriculas/${m3.id}`, admin.token, null, 204);

  // ------------------------------------------------------------------ auditoria
  const audit = (acao) => db.auditoria.count({ where: { acao, instituicaoId: tenants[0], autorId: { in: [admin.id, secretaria.id] } } });
  assert.equal(await audit('DESVINCULAR_PROFESSOR'), 1);
  assert.equal(await audit('DESVINCULAR_TUTOR'), 1);
  assert.equal(await audit('REMOVER_MATRICULA'), 3);

  // ------------------------------------------------------------------ cadastro manual
  section('cadastro manual: senha temporária e troca obrigatória');
  const generated = await call('POST', '/usuarios', admin.token, { nome: 'Pessoa Sem Senha', email: `semsenha.${tag}@example.test`, perfil: 'ALUNO' }, 201);
  testUserIds.push(generated.id);
  assert.equal(generated.senhaTemporaria.length, 14);
  assert.equal(generated.senhaHash, undefined);
  const first = await login({ instituicaoId: tenants[0], email: generated.email }, generated.senhaTemporaria);
  assert.equal((await call('GET', '/auth/me', first.accessToken)).trocaSenhaObrigatoria, true);
  const chosen = await call('POST', '/usuarios', secretaria.token, { nome: 'Pessoa Com Senha', email: `comsenha.${tag}@example.test`, perfil: 'ALUNO', senha: 'senha-escolhida-12' }, 201);
  testUserIds.push(chosen.id);
  assert.equal(chosen.senhaTemporaria, undefined, 'senha informada não volta na resposta');
  assert.equal((await db.usuario.findUnique({ where: { id: chosen.id } })).trocaSenhaObrigatoria, true, 'senha definida pelo administrador também deve ser trocada');
  await call('POST', '/usuarios', admin.token, { nome: 'Senha Curta', email: `curta.${tag}@example.test`, perfil: 'ALUNO', senha: 'curta' }, 400);
  await call('POST', '/usuarios', secretaria.token, { nome: 'Prof Pela Secretaria', email: `profsec.${tag}@example.test`, perfil: 'PROFESSOR' }, 403);
  console.log(`${checks} verificações concluídas`);
}

main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; }).finally(async () => {
  try {
    const extra = await db.usuario.findMany({ where: { instituicaoId: { in: tenants }, email: { contains: `.${tag}@` } }, select: { id: true } });
    const ids = [...new Set([...testUserIds, ...extra.map(({ id }) => id)])];
    if (ids.length) await db.$transaction(async (tx) => {
      const turmas = await tx.turma.findMany({ where: { instituicaoId: { in: tenants }, nome: { in: [`Turma Participantes ${tag}`, `Turma Alheia ${tag}`] } }, select: { id: true } });
      const turmaIds = turmas.map(({ id }) => id);
      const disciplinaIds = (await tx.disciplina.findMany({ where: { turmaId: { in: turmaIds } }, select: { id: true } })).map(({ id }) => id);
      const matriculaIds = (await tx.matricula.findMany({ where: { OR: [{ alunoId: { in: ids } }, { turmaId: { in: turmaIds } }] }, select: { id: true } })).map(({ id }) => id);
      const aulaIds = (await tx.aula.findMany({ where: { disciplinaId: { in: disciplinaIds } }, select: { id: true } })).map(({ id }) => id);
      await tx.presenca.deleteMany({ where: { OR: [{ matriculaId: { in: matriculaIds } }, { aulaId: { in: aulaIds } }] } });
      await tx.aula.deleteMany({ where: { id: { in: aulaIds } } });
      await tx.tutoria.deleteMany({ where: { OR: [{ matriculaId: { in: matriculaIds } }, { tutorId: { in: ids } }] } });
      await tx.lotacao.deleteMany({ where: { OR: [{ disciplinaId: { in: disciplinaIds } }, { professorId: { in: ids } }] } });
      await tx.matricula.deleteMany({ where: { id: { in: matriculaIds } } });
      await tx.disciplina.deleteMany({ where: { id: { in: disciplinaIds } } });
      await tx.turma.deleteMany({ where: { id: { in: turmaIds } } });
      await tx.auditoria.deleteMany({ where: { OR: [{ autorId: { in: ids } }, { recursoId: { in: ids } }] } });
      await tx.sessao.deleteMany({ where: { usuarioId: { in: ids } } });
      await tx.usuario.deleteMany({ where: { id: { in: ids } } });
    }, { timeout: 30000 });
  } catch (error) {
    console.error(`Falha na limpeza dos registros do teste: ${error.message}`);
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
