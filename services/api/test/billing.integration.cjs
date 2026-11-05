// Execute apenas contra um PostgreSQL local após aplicar as migrações.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { Workbook } = require('exceljs');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  BillingService,
  businessDate,
} = require('../dist/billing/billing.service');

assert.equal(
  process.env.TEST_BILLING,
  'true',
  'Defina TEST_BILLING=true para executar',
);
const url = new URL(process.env.DATABASE_URL);
if (url.hostname === 'db') url.hostname = '127.0.0.1';
assert.ok(
  ['localhost', '127.0.0.1'].includes(url.hostname),
  'Teste permitido somente em banco local',
);
const apiUrl = new URL(process.env.TEST_API_URL ?? 'http://127.0.0.1:3000');
assert.ok(
  ['localhost', '127.0.0.1'].includes(apiUrl.hostname),
  'API de teste deve ser local',
);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString() }),
});
const billing = new BillingService(db);
const tenantIds = [];
const runId = randomUUID();

async function call(method, path, token, body, expected = 200, attempt = 0) {
  const response = await fetch(new URL(path, apiUrl), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 429 && path === '/auth/login' && attempt < 2) {
    const seconds = Number(response.headers.get('retry-after'));
    const delay =
      Number.isFinite(seconds) && seconds > 0
        ? Math.min(61_000, seconds * 1000 + 1000)
        : 61_000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return call(method, path, token, body, expected, attempt + 1);
  }
  const bodyText = await response.text();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${response.status} ${bodyText.slice(0, 300)}`,
  );
  return bodyText ? JSON.parse(bodyText) : null;
}

async function importSourceWorkbook(kind, row, token, expected = 201, templateToken = token) {
  const base = `/ml/fontes/importacoes/${kind}`;
  const model = await fetch(new URL(`${base}/modelo`, apiUrl), {
    headers: { Authorization: `Bearer ${templateToken}` },
  });
  assert.equal(model.status, 200);
  const workbook = new Workbook();
  await workbook.xlsx.load(Buffer.from(await model.arrayBuffer()));
  workbook.getWorksheet('Importacao').addRow(row);
  const form = new FormData();
  form.append('arquivo', new Blob([Buffer.from(await workbook.xlsx.writeBuffer())], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), 'fonte.xlsx');
  const response = await fetch(new URL(base, apiUrl), {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  const body = await response.json();
  assert.equal(response.status, expected, JSON.stringify(body));
  return body;
}

async function main() {
  const password = `${randomUUID()}A!`;
  const passwordHash = await argon2.hash(password);
  const first = await db.instituicao.create({
    data: { nome: `Instituição teste ${runId}` },
  });
  tenantIds.push(first.id);
  const second = await db.instituicao.create({
    data: { nome: `Instituição teste isolada ${runId}` },
  });
  tenantIds.push(second.id);
  const admin = await db.usuario.create({
    data: {
      instituicaoId: first.id,
      email: `admin.${runId}@example.test`,
      nome: 'Admin de teste',
      senhaHash: passwordHash,
      perfil: 'ADMIN',
    },
  });
  const outsider = await db.usuario.create({
    data: {
      instituicaoId: second.id,
      email: `outro.${runId}@example.test`,
      nome: 'Outro admin de teste',
      senhaHash: passwordHash,
      perfil: 'ADMIN',
    },
  });
  const finance = await db.usuario.create({
    data: {
      instituicaoId: first.id,
      email: `financeiro.${runId}@example.test`,
      nome: 'Financeiro de teste',
      senhaHash: passwordHash,
      perfil: 'FINANCEIRO',
    },
  });
  const secretary = await db.usuario.create({
    data: {
      instituicaoId: first.id,
      email: `secretaria.${runId}@example.test`,
      nome: 'Secretaria de teste',
      senhaHash: passwordHash,
      perfil: 'SECRETARIA',
    },
  });
  const student = await db.usuario.create({
    data: {
      instituicaoId: first.id,
      email: `aluno.${runId}@example.test`,
      nome: 'Aluno de teste',
      senhaHash: passwordHash,
      perfil: 'ALUNO',
    },
  });
  const peer = await db.usuario.create({
    data: {
      instituicaoId: first.id,
      email: `colega.${runId}@example.test`,
      nome: 'Colega de teste',
      senhaHash: passwordHash,
      perfil: 'ALUNO',
    },
  });
  const turma = await db.turma.create({
    data: {
      instituicaoId: first.id,
      nome: `Turma ${runId}`,
      curso: 'Curso fictício',
      periodo: 'Teste',
    },
  });
  const enrollment = await db.matricula.create({
    data: {
      instituicaoId: first.id,
      turmaId: turma.id,
      alunoId: student.id,
      registro: `TEST-${runId.slice(0, 32)}`,
    },
  });
  const adminActor = {
    id: admin.id,
    instituicaoId: first.id,
    perfil: 'ADMIN',
    sessaoId: runId,
  };
  const outsideActor = {
    id: outsider.id,
    instituicaoId: second.id,
    perfil: 'ADMIN',
    sessaoId: runId,
  };
  const studentActor = {
    id: student.id,
    instituicaoId: first.id,
    perfil: 'ALUNO',
    sessaoId: runId,
  };
  const adminToken = (
    await call('POST', '/auth/login', null, {
      instituicaoId: first.id,
      email: admin.email,
      senha: password,
    })
  ).accessToken;
  const studentToken = (
    await call('POST', '/auth/login', null, {
      instituicaoId: first.id,
      email: student.email,
      senha: password,
    })
  ).accessToken;
  const peerToken = (
    await call('POST', '/auth/login', null, {
      instituicaoId: first.id,
      email: peer.email,
      senha: password,
    })
  ).accessToken;
  const outsideToken = (
    await call('POST', '/auth/login', null, {
      instituicaoId: second.id,
      email: outsider.email,
      senha: password,
    })
  ).accessToken;
  const financeToken = (
    await call('POST', '/auth/login', null, {
      instituicaoId: first.id,
      email: finance.email,
      senha: password,
    })
  ).accessToken;
  const secretaryToken = (
    await call('POST', '/auth/login', null, {
      instituicaoId: first.id,
      email: secretary.email,
      senha: password,
    })
  ).accessToken;
  const today = businessDate(new Date());
  const month = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
  );
  const monthText = month.toISOString().slice(0, 7);
  const beforeDue = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 2, 12),
  );
  const afterDue = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 2, 12),
  );

  assert.equal(
    (await call('GET', '/auth/me', financeToken)).perfil,
    'FINANCEIRO',
  );
  assert.equal(
    (await call('GET', '/auth/me', secretaryToken)).perfil,
    'SECRETARIA',
  );
  await call('GET', '/usuarios', financeToken, null, 403);
  await call('GET', '/academico/resumo', financeToken, null, 403);
  await call('GET', '/ml/status', financeToken, null, 403);
  await call('GET', '/ml/previsoes-automaticas', financeToken, null, 403);
  assert.deepEqual(await call('GET', '/ml/previsoes-automaticas', adminToken), []);
  await call(
    'GET',
    `/faturas/matriculas/${enrollment.id}`,
    secretaryToken,
    null,
    403,
  );
  await call('GET', '/ml/status', secretaryToken, null, 403);
  const financeSearch = await call('GET', `/faturas/matriculas?registro=TEST-${runId.slice(0, 8)}`, financeToken);
  assert.ok(financeSearch.some((item) => item.id === enrollment.id));
  assert.equal((await call('GET', `/faturas/matriculas?registro=TEST-${runId.slice(0, 8)}`, outsideToken)).length, 0);
  await call('GET', '/faturas/matriculas?registro=T', financeToken, null, 400);
  await call('GET', '/faturas/matriculas?registro=TEST', secretaryToken, null, 403);
  assert.ok((await call('GET', `/ml/ingressos/matriculas?registro=TEST-${runId.slice(0, 8)}`, secretaryToken)).some((item) => item.id === enrollment.id));
  assert.deepEqual(await call('GET', '/ml/ingressos/pendentes', secretaryToken), []);
  await call('GET', '/ml/ingressos/pendentes', financeToken, null, 403);
  await call('GET', '/ml/ingressos/matriculas?registro=TEST', financeToken, null, 403);
  assert.ok((await call('GET', '/ml/schema', secretaryToken)).features.includes('estado_civil'));
  assert.ok(
    (await call('GET', '/turmas', secretaryToken)).some(
      (item) => item.id === turma.id,
    ),
  );
  assert.ok(
    (await call('GET', '/usuarios', secretaryToken)).every(
      (item) => item.perfil === 'ALUNO',
    ),
  );
  assert.ok(
    (await call('GET', '/usuarios', adminToken)).every(
      (item) => item.instituicaoId === first.id,
    ),
  );
  await call(
    'GET',
    `/turmas?instituicaoId=${second.id}`,
    adminToken,
    null,
    404,
  );
  await call(
    'POST',
    '/turmas',
    adminToken,
    {
      instituicaoId: second.id,
      nome: 'Turma externa',
      curso: 'Curso',
      periodo: 'Teste',
    },
    404,
  );
  await call(
    'POST',
    '/usuarios',
    secretaryToken,
    {
      email: `admin-negado.${runId}@example.test`,
      nome: 'Admin negado',
      senha: password,
      perfil: 'ADMIN',
    },
    403,
  );
  await call(
    'POST',
    '/usuarios',
    secretaryToken,
    {
      instituicaoId: second.id,
      email: `outro-aluno.${runId}@example.test`,
      nome: 'Aluno externo',
      senha: password,
      perfil: 'ALUNO',
    },
    404,
  );
  const createdStudent = await call(
    'POST',
    '/usuarios',
    secretaryToken,
    {
      email: `novo-aluno.${runId}@example.test`,
      nome: 'Novo aluno',
      senha: password,
      perfil: 'ALUNO',
    },
    201,
  );
  assert.equal(createdStudent.perfil, 'ALUNO');
  await call(
    'POST',
    '/matriculas',
    secretaryToken,
    {
      turmaId: turma.id,
      alunoId: peer.id,
      registro: `SEC-${runId.slice(0, 8)}`,
    },
    201,
  );
  await call(
    'POST',
    '/matriculas',
    financeToken,
    {
      turmaId: turma.id,
      alunoId: createdStudent.id,
      registro: `FIN-${runId.slice(0, 8)}`,
    },
    403,
  );
  await call('GET', `/ml/matriculas/${enrollment.id}`, adminToken);
  await call('GET', `/ml/matriculas/${enrollment.id}`, outsideToken, null, 404);

  await assert.rejects(
    billing.setMonthlyPlan(outsideActor, enrollment.id, {
      inicioCompetencia: monthText,
      valorCentavos: 10000,
      diaVencimento: 15,
      ativo: true,
    }),
    { status: 404 },
  );
  await call('GET', `/faturas/matriculas/${enrollment.id}`, null, null, 401);
  assert.equal(await call('GET', `/faturas/matriculas/${enrollment.id}/plano`, financeToken), null);
  await call('GET', `/faturas/matriculas/${enrollment.id}/plano`, studentToken, null, 403);
  await call('GET', `/faturas/matriculas/${enrollment.id}/plano`, outsideToken, null, 404);
  await call(
    'PUT',
    `/faturas/matriculas/${enrollment.id}/plano`,
    studentToken,
    {
      inicioCompetencia: monthText,
      valorCentavos: 10000,
      diaVencimento: 15,
      ativo: true,
    },
    403,
  );
  await call(
    'PUT',
    `/faturas/matriculas/${enrollment.id}/plano`,
    outsideToken,
    {
      inicioCompetencia: monthText,
      valorCentavos: 10000,
      diaVencimento: 15,
      ativo: true,
    },
    404,
  );
  await call(
    'PUT',
    `/faturas/matriculas/${enrollment.id}/plano`,
    financeToken,
    {
      inicioCompetencia: monthText,
      fimCompetencia: monthText,
      valorCentavos: 10000,
      diaVencimento: 15,
      ativo: true,
    },
  );
  assert.equal((await call('GET', `/faturas/matriculas/${enrollment.id}/plano`, financeToken)).diaVencimento, 15);
  assert.equal(await billing.processMonthly(beforeDue), 1);
  assert.equal(await billing.processMonthly(beforeDue), 0);
  const invoices = await billing.list(studentActor, enrollment.id);
  assert.equal(invoices.length, 1);
  const invoice = invoices[0];
  assert.equal(invoice.semestre, 1);
  assert.equal((await call('GET', `/faturas/matriculas/${enrollment.id}/semestres`, studentToken)).length, 6);
  await call('GET', `/faturas/matriculas/${enrollment.id}/semestres`, peerToken, null, 404);
  assert.equal(
    (await call('GET', `/faturas/matriculas/${enrollment.id}`, studentToken))
      .length,
    1,
  );
  assert.equal(
    (await call('GET', `/faturas/matriculas/${enrollment.id}`, financeToken))
      .length,
    1,
  );
  await call(
    'GET',
    `/faturas/matriculas/${enrollment.id}`,
    peerToken,
    null,
    404,
  );
  await call(
    'GET',
    `/faturas/matriculas/${enrollment.id}`,
    outsideToken,
    null,
    404,
  );
  await call(
    'POST',
    `/faturas/${invoice.id}/pagamentos`,
    studentToken,
    {
      referencia: `aluno-${runId}`,
      valorCentavos: 1000,
    },
    403,
  );
  assert.equal(invoice.situacao, 'ABERTA');
  assert.equal(invoice.valorCentavos, 10000);
  assert.deepEqual(
    (
      await db.perfilMl.findUniqueOrThrow({
        where: { matriculaId: enrollment.id },
      })
    ).features,
    { devedor: 0, mensalidade_em_dia: 1 },
  );
  await assert.rejects(billing.list(outsideActor, enrollment.id), {
    status: 404,
  });
  await assert.rejects(
    billing.recordPayment(outsideActor, invoice.id, {
      referencia: `externo-${runId}`,
      valorCentavos: 1000,
    }),
    { status: 404 },
  );

  await db.perfilMl.update({
    where: { matriculaId: enrollment.id },
    data: { resultado: { marker: 'before-due' } },
  });
  assert.equal(await billing.processOverdue(afterDue), 1);
  const overdue = await db.perfilMl.findUniqueOrThrow({
    where: { matriculaId: enrollment.id },
  });
  assert.equal(overdue.versao, 2);
  assert.equal(overdue.resultado, null);
  assert.deepEqual(overdue.features, { devedor: 1, mensalidade_em_dia: 0 });
  await billing.recordPayment(
    adminActor,
    invoice.id,
    {
      referencia: `parcial-${runId}`,
      valorCentavos: 3000,
    },
    afterDue,
  );
  assert.equal(
    (await db.fatura.findUniqueOrThrow({ where: { id: invoice.id } })).situacao,
    'VENCIDA',
  );
  await assert.rejects(
    billing.recordPayment(
      adminActor,
      invoice.id,
      { referencia: `parcial-${runId}`, valorCentavos: 1000 },
      afterDue,
    ),
    { status: 409 },
  );
  await assert.rejects(
    billing.recordPayment(
      adminActor,
      invoice.id,
      { referencia: `excesso-${runId}`, valorCentavos: 7001 },
      afterDue,
    ),
    { status: 400 },
  );
  await billing.recordPayment(
    adminActor,
    invoice.id,
    {
      referencia: `saldo-${runId}`,
      valorCentavos: 7000,
    },
    afterDue,
  );
  const paid = await db.perfilMl.findUniqueOrThrow({
    where: { matriculaId: enrollment.id },
  });
  assert.equal(paid.versao, 3);
  assert.deepEqual(paid.features, { devedor: 0, mensalidade_em_dia: 1 });
  const events = await db.atributoMlEvento.findMany({
    where: { instituicaoId: first.id, matriculaId: enrollment.id },
    orderBy: [{ versaoPerfil: 'asc' }, { atributo: 'asc' }],
  });
  assert.equal(events.length, 6);
  assert.deepEqual(events.map((event) => event.versaoPerfil), [1, 1, 2, 2, 3, 3]);
  assert.ok(events.every((event) => event.origem === 'FINANCEIRO'));
  assert.equal(
    (await call('GET', `/ml/matriculas/${enrollment.id}/atributos/historico`, adminToken)).total,
    6,
  );
  await call('GET', `/ml/matriculas/${enrollment.id}/atributos/historico`, financeToken, null, 403);
  await call('GET', `/ml/matriculas/${enrollment.id}/atributos/historico`, studentToken, null, 403);
  await call('GET', `/ml/matriculas/${enrollment.id}/atributos/historico`, outsideToken, null, 404);
  const scholarshipPath = `/bolsas/matriculas/${enrollment.id}`;
  await call('PUT', scholarshipPath, studentToken, { inicio: today.toISOString().slice(0, 10), ativa: true }, 403);
  await call('PUT', scholarshipPath, secretaryToken, { inicio: today.toISOString().slice(0, 10), ativa: true }, 403);
  await call('PUT', scholarshipPath, outsideToken, { inicio: today.toISOString().slice(0, 10), ativa: true }, 404);
  await call('PUT', scholarshipPath, financeToken, { inicio: today.toISOString().slice(0, 10), ativa: true });
  assert.equal((await call('GET', scholarshipPath, studentToken)).vigente, true);
  assert.equal((await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } })).features.bolsista, 1);
  await call('PUT', scholarshipPath, financeToken, { inicio: today.toISOString().slice(0, 10), ativa: false });
  assert.equal((await call('GET', scholarshipPath, studentToken)).vigente, false);
  const revokedProfile = await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } });
  assert.equal(revokedProfile.features.bolsista, 0);
  assert.equal(revokedProfile.versao, 5);
  await call('PUT', scholarshipPath, financeToken, { inicio: today.toISOString().slice(0, 10), ativa: false });
  assert.equal((await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } })).versao, 5);
  assert.equal(
    await db.atributoMlEvento.count({ where: { matriculaId: enrollment.id, origem: 'BOLSA' } }),
    2,
  );
  const semesterPath = `/ml/matriculas/${enrollment.id}/semestres`;
  const firstSemester = {
    versao: 0,
    creditadas: 1,
    matriculadas: 6,
    avaliacoes: 7,
    aprovadas: 5,
    nota: 14.5,
    semAvaliacao: 1,
    fonteRef: `pauta-homologada-${runId}`,
  };
  await call('PUT', `${semesterPath}/1`, financeToken, firstSemester, 403);
  await call('PUT', `${semesterPath}/1`, outsideToken, firstSemester, 404);
  await call('PUT', `${semesterPath}/1`, secretaryToken, firstSemester);
  assert.equal((await call('GET', `${semesterPath}/1`, secretaryToken)).nota, 14.5);
  await call('PUT', `${semesterPath}/1`, secretaryToken, firstSemester, 409);
  await call('PUT', `${semesterPath}/1`, secretaryToken,
    { ...firstSemester, versao: 1, semAvaliacao: 7 }, 400);
  await call('PUT', `${semesterPath}/2`, secretaryToken, {
    ...firstSemester, nota: 16, aprovadas: 6, semAvaliacao: 0,
  });
  const academicProfile = await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } });
  assert.equal(academicProfile.features.ucs_1sem_nota, 14.5);
  assert.equal(academicProfile.features.ucs_2sem_nota, 16);
  assert.equal(academicProfile.versao, 7);
  assert.equal(await db.atributoMlEvento.count({ where: { matriculaId: enrollment.id, origem: 'ACADEMICO_OFICIAL' } }), 12);

  const macroYear = today.getUTCFullYear();
  const macroPath = `/ml/fontes/macro/PT/${macroYear}`;
  const macro = {
    desemprego: 6.2,
    inflacao: 2.4,
    pib: 1.8,
    fonteUrl: 'https://www.ine.pt/indicadores/validacao-local',
  };
  await call('PUT', macroPath, secretaryToken, macro, 403);
  await call('PUT', macroPath, adminToken, macro);
  await call('PUT', `/ml/matriculas/${enrollment.id}/coorte-macro`, secretaryToken,
    { pais: 'PT', ano: macroYear });
  assert.equal((await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } })).features.desemprego, 6.2);
  assert.equal((await call('GET', `/ml/matriculas/${enrollment.id}/coorte-macro`, secretaryToken)).macroAno, macroYear);
  await call('PUT', macroPath, adminToken, { ...macro, desemprego: 6.4, pib: 2.1 });
  const macroProfile = await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } });
  assert.equal(macroProfile.features.desemprego, 6.4);
  assert.equal(macroProfile.features.pib, 2.1);
  assert.equal(await db.atributoMlEvento.count({ where: { matriculaId: enrollment.id, origem: 'MACRO_OFICIAL' } }), 5);
  await call('PUT', macroPath, adminToken, { ...macro, desemprego: 6.4, pib: 2.1 });
  assert.equal((await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } })).versao, macroProfile.versao);
  await call('PUT', `/ml/matriculas/${enrollment.id}`, adminToken,
    { versao: macroProfile.versao, features: { ucs_1sem_nota: 0 } }, 400);
  await call('PUT', `/ml/matriculas/${enrollment.id}`, adminToken,
    { versao: macroProfile.versao, features: { desemprego: 0 } }, 400);
  assert.equal(
    (await db.fatura.findUniqueOrThrow({ where: { id: invoice.id } })).situacao,
    'QUITADA',
  );
  assert.equal(
    (await db.pagamentoFatura.findMany({ where: { faturaId: invoice.id } }))
      .length,
    2,
  );
  await call('PUT', `/ml/matriculas/${enrollment.id}/declaracao-ingresso`, studentToken,
    { versao: 0, dados: { estadoCivil: 'SOLTEIRO' } });
  assert.ok((await call('GET', '/ml/ingressos/pendentes', secretaryToken)).some((item) => item.matriculaId === enrollment.id));
  const currentIngress = await call('GET', `/ml/matriculas/${enrollment.id}/ingresso`, secretaryToken);
  await call('PUT', `/ml/matriculas/${enrollment.id}/ingresso`, secretaryToken,
    { versao: currentIngress.official?.revisao ?? 0, fonteRef: 'Ficha oficial de teste', features: { estado_civil: 1 } });
  assert.equal((await call('GET', '/ml/ingressos/pendentes', secretaryToken)).some((item) => item.matriculaId === enrollment.id), false);
  const nextCompetence = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const simulationInvoice = await call('POST', '/faturas', financeToken, {
    matriculaId: enrollment.id,
    competencia: nextCompetence.toISOString().slice(0, 7),
    vencimento: new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
    valorCentavos: 12000,
  }, 201);
  assert.equal(simulationInvoice.semestre, 1);
  assert.equal((await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } })).features.devedor, 1);
  await call('POST', `/faturas/${simulationInvoice.id}/simular-pagamento`, peerToken, null, 404);
  await call('POST', `/faturas/${simulationInvoice.id}/simular-pagamento`, financeToken, null, 403);
  await call('POST', `/faturas/${simulationInvoice.id}/simular-pagamento`, studentToken, null, 201);
  await call('POST', `/faturas/${simulationInvoice.id}/simular-pagamento`, studentToken, null, 409);
  const simulated = await db.pagamentoFatura.findFirstOrThrow({ where: { faturaId: simulationInvoice.id } });
  assert.equal(simulated.simulado, true);
  assert.equal(simulated.valorCentavos, 12000);
  assert.equal((await db.perfilMl.findUniqueOrThrow({ where: { matriculaId: enrollment.id } })).features.devedor, 0);
  assert.equal((await call('GET', `/faturas/matriculas/${enrollment.id}/semestres`, studentToken))[0].pagoCentavos, 22000);
  const semesterWorkbookRow = [enrollment.registro, 1, 2, 6, 7, 5, 15, 1, 'Resumo institucional importado'];
  assert.equal((await importSourceWorkbook('semestres', semesterWorkbookRow, secretaryToken)).salvos, 1);
  assert.equal((await importSourceWorkbook('semestres', semesterWorkbookRow, secretaryToken)).repetidos, 1);
  assert.equal((await importSourceWorkbook('semestres', semesterWorkbookRow, studentToken, 403, secretaryToken)).statusCode, 403);
  const macroWorkbookRow = ['PT', macroYear, 6.5, 2.4, 2.2, 'https://www.ine.pt/indicadores/planilha-local'];
  assert.equal((await importSourceWorkbook('macro', macroWorkbookRow, adminToken)).salvos, 1);
  assert.equal((await importSourceWorkbook('macro', macroWorkbookRow, adminToken)).repetidos, 1);
  assert.equal((await importSourceWorkbook('macro', macroWorkbookRow, secretaryToken, 403, adminToken)).statusCode, 403);
  console.log(
    'Integração de fontes: faturas, bolsas, semestres e macroeconomia aprovados',
  );
}

async function cleanup() {
  if (!tenantIds.length) return;
  await db.sessao.deleteMany({ where: { instituicaoId: { in: tenantIds } } });
  await db.auditoria.deleteMany({
    where: { instituicaoId: { in: tenantIds } },
  });
  await db.matricula.deleteMany({
    where: { instituicaoId: { in: tenantIds } },
  });
  await db.turma.deleteMany({ where: { instituicaoId: { in: tenantIds } } });
  await db.usuario.deleteMany({ where: { instituicaoId: { in: tenantIds } } });
  await db.indicadorMacro.deleteMany({ where: { instituicaoId: { in: tenantIds } } });
  await db.instituicao.deleteMany({ where: { id: { in: tenantIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error('Falha na limpeza do teste', error);
      process.exitCode = 1;
    }
    await db.$disconnect();
  });
