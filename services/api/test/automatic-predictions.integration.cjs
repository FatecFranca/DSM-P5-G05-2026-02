// Execute somente contra o PostgreSQL local de desenvolvimento.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  AutomaticPredictionsService,
} = require('../dist/ml/automatic-predictions.service');
const { demoProfile } = require('../dist/ml/demo-profiles');
const { ACTIVE_MODEL_VERSION } = require('../dist/ml/model-version');

assert.equal(
  process.env.TEST_AUTO_ML,
  'true',
  'Defina TEST_AUTO_ML=true para executar',
);
const url = new URL(process.env.DATABASE_URL);
if (url.hostname === 'db') url.hostname = '127.0.0.1';
assert.ok(
  ['localhost', '127.0.0.1'].includes(url.hostname),
  'Teste permitido somente em banco local',
);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString() }),
});
const tenantIds = [];

async function main() {
  const institution = await db.instituicao.create({
    data: { nome: `Teste recálculo ${randomUUID()}` },
  });
  tenantIds.push(institution.id);
  const passwordHash = await argon2.hash(randomUUID());
  const admin = await db.usuario.create({
    data: {
      instituicaoId: institution.id,
      nome: 'Admin teste',
      email: `auto-admin-${randomUUID()}@example.test`,
      senhaHash: passwordHash,
      perfil: 'COORDENACAO',
    },
  });
  const student = await db.usuario.create({
    data: {
      instituicaoId: institution.id,
      nome: 'Aluno teste',
      email: `auto-student-${randomUUID()}@example.test`,
      senhaHash: passwordHash,
      perfil: 'ALUNO',
    },
  });
  const course = await db.turma.create({
    data: {
      instituicaoId: institution.id,
      nome: 'Turma teste',
      curso: 'Curso teste',
      periodo: 'Teste',
    },
  });
  const enrollment = await db.matricula.create({
    data: {
      instituicaoId: institution.id,
      turmaId: course.id,
      alunoId: student.id,
      registro: `AUTO-${randomUUID().slice(0, 20)}`,
    },
  });
  const initial = demoProfile(0);
  await db.perfilMl.create({
    data: {
      matriculaId: enrollment.id,
      instituicaoId: institution.id,
      features: initial,
      fonte: 'Importação de teste',
    },
  });
  await db.previsaoImportadaMl.create({
    data: {
      instituicaoId: institution.id,
      matriculaId: enrollment.id,
      arquivoSha256: '0'.repeat(64),
      linha: 2,
      modelVersion: ACTIVE_MODEL_VERSION,
      perfilVersao: 1,
      features: initial,
      predictedClass: 'Graduate',
      probabilities: { Dropout: 0.2, Graduate: 0.8 },
      autorId: admin.id,
    },
  });
  const fakeMl = {
    status: async () => ({
      ready: true,
      originalInputReady: true,
      modelVersion: ACTIVE_MODEL_VERSION,
    }),
    predictBatch: async (request) => ({
      results: request.items.map((item) => ({
        ref: item.ref,
        predicted_class: 'Dropout',
        probabilities: { Dropout: 0.7, Graduate: 0.3 },
      })),
    }),
  };
  const worker = new AutomaticPredictionsService(db, fakeMl, {
    get: () => 'true',
  });
  const first = { ...initial, devedor: initial.devedor === 1 ? 0 : 1 };
  await db.perfilMl.update({
    where: { matriculaId: enrollment.id },
    data: { features: first, versao: { increment: 1 } },
  });
  assert.equal(await worker.processPending(), 1);
  assert.equal(await worker.processPending(), 0);
  const second = {
    ...first,
    mensalidade_em_dia: first.mensalidade_em_dia === 1 ? 0 : 1,
  };
  await db.perfilMl.update({
    where: { matriculaId: enrollment.id },
    data: { features: second, versao: { increment: 1 } },
  });
  assert.equal(await worker.processPending(), 1);
  const history = await worker.recent({
    id: admin.id,
    instituicaoId: institution.id,
    perfil: 'COORDENACAO',
    sessaoId: randomUUID(),
  });
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((item) => item.perfilVersao).sort(), [2, 3]);
  assert.equal(history.filter((item) => item.atual).length, 1);
  assert.ok(
    history.every(
      (item) => item.origem === 'AUTOMATICA' && item.status === 'EXPERIMENTAL',
    ),
  );
  assert.equal(
    (
      await db.perfilMl.findUniqueOrThrow({
        where: { matriculaId: enrollment.id },
      })
    ).resultado,
    null,
  );
  await db.perfilMl.update({
    where: { matriculaId: enrollment.id },
    data: { features: { devedor: 1 }, versao: { increment: 1 } },
  });
  assert.equal(await worker.processPending(), 0);
  assert.equal(
    await db.previsaoAutomaticaMl.count({
      where: { matriculaId: enrollment.id },
    }),
    2,
  );
  console.log(
    'Recálculo experimental: versões, histórico, deduplicação e perfil incompleto aprovados',
  );
}

async function cleanup() {
  if (!tenantIds.length) return;
  await db.auditoria.deleteMany({
    where: { instituicaoId: { in: tenantIds } },
  });
  await db.matricula.deleteMany({
    where: { instituicaoId: { in: tenantIds } },
  });
  await db.turma.deleteMany({ where: { instituicaoId: { in: tenantIds } } });
  await db.usuario.deleteMany({ where: { instituicaoId: { in: tenantIds } } });
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
