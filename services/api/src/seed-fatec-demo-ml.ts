import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client';
import {
  FATEC_DEMO_ML_SOURCE,
  FATEC_DEMO_REGISTRATIONS,
  fatecDemoProfile,
} from './ml/fatec-demo-profile';
import { ML_FEATURES } from './ml/ml.types';
import { validProfile } from './ml/profile-validation';

async function main() {
  if (process.env.FATEC_DEMO_ML_SEED_ENABLED !== 'true') {
    throw new Error('Carga demonstrativa não habilitada');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL ausente');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const targets = await db.matricula.findMany({
      where: {
        registro: { in: [...FATEC_DEMO_REGISTRATIONS] },
        aluno: { nome: 'Aluno Demo SGEI', perfil: 'ALUNO' },
        turma: { nome: 'Turma Demo SGEI' },
      },
      select: {
        id: true,
        instituicaoId: true,
        registro: true,
        turma: { select: { instituicao: { select: { codigoCps: true } } } },
        perfilMl: {
          select: {
            features: true,
            fonte: true,
            resultado: true,
            versao: true,
          },
        },
      },
    });
    if (
      targets.length !== FATEC_DEMO_REGISTRATIONS.length ||
      targets.some(
        (item) =>
          item.registro !== `SGEI-DEMO-${item.turma.instituicao.codigoCps}`,
      ) ||
      new Set(targets.map((item) => item.registro)).size !== targets.length
    ) {
      throw new Error(
        'Quatro matrículas Demo SGEI esperadas; nenhuma alteração aplicada',
      );
    }

    await db.$transaction(async (tx) => {
      for (const target of targets) {
        const previous = target.perfilMl?.features ?? {};
        if (!validProfile(previous)) {
          throw new Error('Ficha demonstrativa existente incompatível');
        }
        const features = { ...fatecDemoProfile(target.registro), ...previous };
        if (
          !validProfile(features) ||
          ML_FEATURES.some((name) => !Number.isFinite(features[name]))
        ) {
          throw new Error('Ficha demonstrativa incompleta');
        }
        if (
          target.perfilMl?.fonte === FATEC_DEMO_ML_SOURCE &&
          target.perfilMl.resultado === null &&
          ML_FEATURES.every((name) => previous[name] === features[name])
        ) {
          continue;
        }
        if (target.perfilMl) {
          const updated = await tx.perfilMl.updateMany({
            where: {
              matriculaId: target.id,
              instituicaoId: target.instituicaoId,
              versao: target.perfilMl.versao,
            },
            data: {
              features,
              fonte: FATEC_DEMO_ML_SOURCE,
              resultado: Prisma.DbNull,
              versao: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new Error('Ficha alterada durante a carga');
        } else {
          await tx.perfilMl.create({
            data: {
              matriculaId: target.id,
              instituicaoId: target.instituicaoId,
              features,
              fonte: FATEC_DEMO_ML_SOURCE,
            },
          });
        }
        await tx.auditoria.create({
          data: {
            instituicaoId: target.instituicaoId,
            acao: 'SEED_DEMO_ML',
            recurso: 'MATRICULA',
            recursoId: target.id,
          },
        });
      }
    });
    process.stdout.write(
      `${targets.length} fichas ML demonstrativas prontas\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Falha na carga demonstrativa'}\n`,
  );
  process.exitCode = 1;
});
