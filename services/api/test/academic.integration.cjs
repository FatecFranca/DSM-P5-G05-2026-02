// Local integration test: creates and removes two isolated institutions.
// Run after build + migration, with the API and PostgreSQL available locally.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const argon2 = require('argon2');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const dbUrl = new URL(process.env.DATABASE_URL);
if (dbUrl.hostname === 'db') dbUrl.hostname = '127.0.0.1';
assert.ok(['localhost', '127.0.0.1'].includes(dbUrl.hostname), 'Teste permitido somente em banco local');
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString() }) });
const tenants = [randomUUID(), randomUUID()];
const uploaded = [];
let checks = 0;
async function call(method, path, token, body, expected = 200) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
  const bytes = await response.arrayBuffer();
  const value = response.headers.get('content-type')?.includes('application/json') && bytes.byteLength ? JSON.parse(Buffer.from(bytes).toString()) : bytes;
  assert.equal(response.status, expected, `${method} ${path}: ${response.status}; ${typeof value === 'object' && !(value instanceof ArrayBuffer) ? JSON.stringify(value) : ''}`);
  checks++;
  return value;
}
async function main() {
  const senha = randomUUID() + 'A!';
  const senhaHash = await argon2.hash(senha);
  for (const id of tenants) await db.instituicao.create({ data: { id, nome: 'Teste isolado acadêmico' } });
  const people = [];
  for (const [index, perfil] of ['ADMIN', 'PROFESSOR', 'ALUNO', 'ALUNO', 'ADMIN'].entries()) {
    const user = await db.usuario.create({ data: { instituicaoId: tenants[index === 4 ? 1 : 0], email: `p${index}@example.test`, nome: `Pessoa de teste ${index}`, senhaHash, perfil } });
    const tokens = await call('POST', '/auth/login', null, { instituicaoId: user.instituicaoId, email: user.email, senha });
    people.push({ ...user, token: tokens.accessToken, refresh: tokens.refreshToken });
  }
  const [admin, teacher, student, peer, outsider] = people;
  if (process.env.TEST_ML === 'true') {
    const parameters = require('../../ml/app/preprocessing/notebook-zscore-v1.json');
    const original = Object.fromEntries(parameters.features.map((name) => [name, parameters.categories[name]?.[0] ?? 0]));
    Object.assign(original, { idade_matricula: 20, nota_admissao: 120, nota_qual_anterior: 120 });
    const processed = Object.fromEntries(Object.entries(original).map(([name, value]) => {
      const p = parameters.numeric[name];
      return [name, p ? (value - p.mean) / p.std : value];
    }));
    await call('GET', '/ml/schema', null, null, 401);
    await call('GET', '/ml/schema', student.token, null, 403);
    await call('POST', '/ml/preview', student.token, { features: processed }, 403);
    assert.equal((await call('GET', '/ml/schema', admin.token)).features.length, 36);
    assert.equal((await call('GET', '/ml/status', admin.token)).originalInputReady, true);
    const a = await call('POST', '/ml/preview', admin.token, { features: original, inputFormat: 'original' });
    const b = await call('POST', '/ml/preview', admin.token, { features: processed, inputFormat: 'preprocessed' });
    assert.deepEqual(a, b, 'Ambos os formatos devem gerar a mesma previsão real');
    assert.ok(['Dropout', 'Enrolled', 'Graduate'].includes(a.predictedClass));
    assert.ok(Math.abs(Object.values(a.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-6);
    await call('POST', '/ml/preview', admin.token, { features: original, inputFormat: 'raw' }, 400);
    await call('POST', '/ml/preview', admin.token, { features: { ...original, genero: 2 }, inputFormat: 'original' }, 400);
    await call('POST', '/ml/preview', admin.token, { features: { ...original, pib: null } }, 400);
  }
  const range = new URLSearchParams({ inicio: new Date(Date.now() - 10 * 86400000).toISOString(), fim: new Date(Date.now() + 2 * 86400000).toISOString() });
  const calendarPath = `/academico/calendario?${range}`;
  await call('GET', '/academico/resumo', null, null, 401);
  await call('GET', '/academico/avisos', null, null, 401);
  await call('GET', '/academico/calendario?inicio=2026-01-01&fim=2027-01-01', student.token, null, 400);
  await call('GET', '/academico/avisos?pagina=0', student.token, null, 400);
  await call('GET', '/academico/avisos?tamanho=51', student.token, null, 400);
  const empty = await call('GET', '/academico/resumo', student.token);
  assert.equal(empty.turmas.length, 0);
  await call('POST', '/turmas', student.token, { nome: 'Teste', curso: 'Teste', periodo: '2026/2' }, 403);
  await call('POST', '/turmas', admin.token, { nome: 'Teste', curso: 'Teste', periodo: '2026/2', instituicaoId: tenants[1] }, 400);
  const turma = await call('POST', '/turmas', admin.token, { nome: 'Teste', curso: 'Teste', periodo: '2026/2' }, 201);
  const subject = await call('POST', '/disciplinas', admin.token, { turmaId: turma.id, nome: 'Matemática' }, 201);
  await call('POST', '/disciplinas', outsider.token, { turmaId: turma.id, nome: 'Intrusão' }, 404);
  await call('POST', '/aulas', teacher.token, { disciplinaId: subject.id, data: new Date().toISOString(), tema: 'Sem lotação' }, 404);
  await call('POST', '/lotacoes', admin.token, { disciplinaId: subject.id, professorId: teacher.id }, 201);
  const enrol = await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: student.id, registro: 'R1' }, 201);
  const peerEnrol = await call('POST', '/matriculas', admin.token, { turmaId: turma.id, alunoId: peer.id, registro: 'R2' }, 201);
  await call('GET', `/academico/resumo?turmaId=${turma.id}`, outsider.token, null, 404);
  const aula = await call('POST', '/aulas', teacher.token, { disciplinaId: subject.id, data: new Date(Date.now() - 1000).toISOString(), tema: 'Aula 1' }, 201);
  await call('PUT', `/aulas/${aula.id}/frequencia`, teacher.token, { itens: [{ matriculaId: enrol.id, situacao: 'PRESENTE' }, { matriculaId: peerEnrol.id, situacao: 'FALTA' }] });
  await call('PUT', `/aulas/${aula.id}/frequencia`, teacher.token, { itens: [{ matriculaId: randomUUID(), situacao: 'PRESENTE' }] }, 400);
  const old = await call('POST', '/aulas', teacher.token, { disciplinaId: subject.id, data: new Date(Date.now() - 8 * 86400000).toISOString(), tema: 'Antiga' }, 201);
  await call('PUT', `/aulas/${old.id}/frequencia`, teacher.token, { itens: [{ matriculaId: enrol.id, situacao: 'PRESENTE' }] }, 403);
  const exam = await call('POST', '/avaliacoes', teacher.token, { disciplinaId: subject.id, titulo: 'Prova', peso: 2, notaMaxima: 20, data: new Date().toISOString() }, 201);
  await call('PUT', `/avaliacoes/${exam.id}/notas`, teacher.token, { itens: [{ matriculaId: enrol.id, valor: 21 }] }, 400);
  await call('PUT', `/avaliacoes/${exam.id}/notas`, teacher.token, { itens: [{ matriculaId: enrol.id, valor: 16 }] });
  await call('POST', `/avaliacoes/${exam.id}/publicar`, teacher.token, null, 400);
  assert.equal((await call('GET', '/academico/resumo', student.token)).avaliacoes.length, 0);
  assert.ok(!(await call('GET', calendarPath, student.token)).itens.some((e) => e.recursoId === exam.id));
  assert.ok(!(await call('GET', '/academico/avisos', student.token)).itens.some((e) => e.recursoId === exam.id));
  await call('PUT', `/avaliacoes/${exam.id}/notas`, teacher.token, { itens: [{ matriculaId: peerEnrol.id, valor: 12 }] });
  await call('POST', `/avaliacoes/${exam.id}/publicar`, teacher.token, null, 201);
  assert.ok((await call('GET', calendarPath, student.token)).itens.some((e) => e.recursoId === exam.id));
  assert.ok((await call('GET', '/academico/avisos', student.token)).itens.some((e) => e.recursoId === exam.id && e.tipo === 'NOTAS'));
  const firstPage = await call('GET', `${calendarPath}&tamanho=1`, student.token);
  const secondPage = await call('GET', `${calendarPath}&tamanho=1&pagina=2`, student.token);
  assert.equal(firstPage.temMais, true);
  assert.notEqual(firstPage.itens[0].id, secondPage.itens[0].id);
  assert.equal((await call('GET', `${calendarPath}&turmaId=${turma.id}`, outsider.token)).itens.length, 0);
  const view = await call('GET', '/academico/resumo', student.token);
  assert.equal(view.matriculas.length, 1);
  assert.equal(view.notas.length, 1);
  assert.equal(view.indicadores[0].media, 8);
  assert.equal(view.indicadores[0].frequencia, 100);
  assert.ok(!JSON.stringify(view).includes('senhaHash'));
  assert.ok(!JSON.stringify(view).includes('probabilidade'));
  const activity = await call('POST', '/atividades', teacher.token, { disciplinaId: subject.id, titulo: 'Trabalho', descricao: 'Descrição', prazo: new Date(Date.now() + 86400000).toISOString(), notaMaxima: 10, estado: 'RASCUNHO' }, 201);
  assert.equal((await call('GET', '/academico/resumo', student.token)).atividades.length, 0);
  assert.ok(!(await call('GET', calendarPath, student.token)).itens.some((e) => e.recursoId === activity.id));
  await call('POST', `/atividades/${activity.id}/publicar`, teacher.token, null, 201);
  assert.ok((await call('GET', '/academico/avisos', student.token)).itens.some((e) => e.recursoId === activity.id && e.tipo === 'ATIVIDADE'));
  const bad = new FormData(); bad.append('arquivo', new Blob(['<script>fake</script>'], { type: 'application/pdf' }), 'fake.pdf');
  await call('POST', '/arquivos', student.token, bad, 400);
  async function upload(token) {
    const form = new FormData(); form.append('arquivo', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }), 'teste.pdf');
    const file = await call('POST', '/arquivos', token, form, 201); uploaded.push(file.id); return file;
  }
  const file = await upload(student.token);
  await call('GET', `/arquivos/${file.id}`, peer.token, null, 404);
  await call('GET', `/arquivos/${file.id}`, outsider.token, null, 404);
  await call('PUT', `/atividades/${activity.id}/entrega`, peer.token, { arquivoId: file.id }, 404);
  await call('PUT', `/atividades/${activity.id}/entrega`, student.token, { arquivoId: file.id });
  await call('GET', `/arquivos/${file.id}`, teacher.token);
  await call('PUT', `/atividades/${activity.id}/entregas/${enrol.id}/correcao`, teacher.token, { nota: 9, feedback: 'Bom trabalho' });
  await call('PUT', `/atividades/${activity.id}/entrega`, student.token, { arquivoId: file.id }, 403);
  assert.equal((await call('GET', '/academico/resumo', peer.token)).entregas.length, 0);
  const materialFile = await upload(teacher.token);
  await call('POST', '/materiais', teacher.token, { disciplinaId: subject.id, arquivoId: materialFile.id, titulo: 'Apostila', descricao: '' }, 201);
  await call('GET', `/arquivos/${materialFile.id}`, student.token);
  const studentNotices = await call('GET', '/academico/avisos', student.token);
  assert.ok(studentNotices.itens.some((e) => e.tipo === 'CORRECAO'));
  assert.ok(studentNotices.itens.some((e) => e.tipo === 'MATERIAL'));
  assert.ok(!(await call('GET', '/academico/avisos', peer.token)).itens.some((e) => e.tipo === 'CORRECAO'));
  assert.equal((await call('GET', '/academico/avisos', outsider.token)).itens.length, 0);
  assert.equal((await call('GET', `/academico/avisos?disciplinaId=${randomUUID()}`, student.token)).itens.length, 0);
  // The same access token must obey the current database role and links.
  await db.usuario.update({ where: { id: peer.id }, data: { perfil: 'TUTOR' } });
  assert.equal((await call('GET', '/academico/resumo', peer.token)).matriculas.length, 0);
  await call('POST', '/tutorias', admin.token, { matriculaId: enrol.id, tutorId: peer.id }, 201);
  const tutorView = await call('GET', '/academico/resumo', peer.token);
  assert.equal(tutorView.matriculas.length, 1);
  assert.equal(tutorView.matriculas[0].id, enrol.id);
  assert.equal(tutorView.materiais.length, 0);
  const tutorNotices = await call('GET', '/academico/avisos', peer.token);
  assert.ok(tutorNotices.itens.some((e) => e.tipo === 'CORRECAO'));
  assert.ok(!tutorNotices.itens.some((e) => e.tipo === 'MATERIAL'));
  await call('GET', `/arquivos/${materialFile.id}`, peer.token, null, 404);
  await call('POST', '/aulas', peer.token, { disciplinaId: subject.id, data: new Date().toISOString(), tema: 'Negado' }, 403);
  await db.usuario.update({ where: { id: peer.id }, data: { perfil: 'COORDENACAO' } });
  assert.equal((await call('GET', '/academico/resumo', peer.token)).matriculas.length, 2);
  await call('POST', '/turmas', peer.token, { nome: 'Negada', curso: 'Teste', periodo: '2026/2' }, 403);
  await call('PATCH', `/turmas/${turma.id}/fechamento`, admin.token, { fechada: true });
  await call('PUT', `/avaliacoes/${exam.id}/notas`, teacher.token, { itens: [{ matriculaId: enrol.id, valor: 10 }] }, 403);
  await call('POST', '/auth/logout', student.token, { refreshToken: student.refresh }, 204);
  await call('GET', '/academico/resumo', student.token, null, 401);
  assert.ok(await db.auditoria.count({ where: { instituicaoId: tenants[0], recurso: 'ACADEMICO' } }) > 0);
  console.log(`Integração acadêmica: ${checks} respostas HTTP verificadas; isolamento, perfis, publicação, notas, frequência, arquivos e revogação aprovados.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  try {
    // Only rows belonging to the randomly generated test institutions are removed.
    await db.$transaction(async (tx) => {
      for (const model of ['entrega', 'material', 'arquivo', 'nota', 'presenca', 'avaliacao', 'atividade', 'aula', 'tutoria', 'lotacao', 'matricula', 'disciplina', 'turma', 'auditoria', 'sessao', 'usuario']) await tx[model].deleteMany({ where: { instituicaoId: { in: tenants } } });
      await tx.instituicao.deleteMany({ where: { id: { in: tenants } } });
    });
    if (uploaded.length) execFileSync('docker', ['compose', 'exec', '-T', 'api', 'node', '-e', 'const fs=require("node:fs");for(const id of process.argv.slice(1)){if(!/^[0-9a-f-]{36}$/.test(id))throw Error("id");fs.rmSync("/app/uploads/"+id,{force:true})}', ...uploaded], { cwd: require('node:path').resolve(__dirname, '../../..'), stdio: 'pipe' });
  } finally { await db.$disconnect(); }
});
