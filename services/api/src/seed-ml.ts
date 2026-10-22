import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { readDemoSeedConfig } from './config/demo-seed-config';
import { seedDemoUsers } from './demo-seed';
import { demoProfile } from './ml/demo-profiles';
import { validProfile } from './ml/profile-validation';

async function main() {
  const config = readDemoSeedConfig(process.env);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
  try {
    await seedDemoUsers(db, config);
    const instituicaoId = config.instituicaoId;
    const senhaHash = await argon2.hash(
      config.users.find((u) => u.perfil === 'ALUNO')!.senha,
    );
    await db.$transaction(
      async (tx) => {
        const turma = await tx.turma.upsert({
          where: {
            instituicaoId_nome_periodo: {
              instituicaoId,
              nome: 'ML — Demonstração integrada',
              periodo: 'Dois semestres completos',
            },
          },
          create: {
            instituicaoId,
            nome: 'ML — Demonstração integrada',
            periodo: 'Dois semestres completos',
            curso: 'Gestão — código UCI 9238',
          },
          update: {},
        });
        const teacher = await tx.usuario.findFirst({
          where: {
            instituicaoId,
            email: 'professor.demo@sgei.example',
            perfil: 'PROFESSOR',
          },
        });
        const tutor = await tx.usuario.findFirst({
          where: {
            instituicaoId,
            email: 'tutor.demo@sgei.example',
            perfil: 'TUTOR',
          },
        });
        for (let index = 0; index < 2; index++) {
          const email = `ml.estudante${index + 1}@sgei.example`;
          // Não modifica registros já existentes, nem restaura perfis editados.
          if (
            await tx.usuario.findUnique({
              where: { instituicaoId_email: { instituicaoId, email } },
            })
          )
            continue;
          const features = demoProfile(index);
          if (!validProfile(features))
            throw new Error('Perfil demonstrativo incompatível');
          const aluno = await tx.usuario.create({
            data: {
              instituicaoId,
              email,
              nome: `Estudante ML ${index + 1} (demonstração)`,
              senhaHash,
              perfil: 'ALUNO',
            },
          });
          const matricula = await tx.matricula.create({
            data: {
              instituicaoId,
              turmaId: turma.id,
              alunoId: aluno.id,
              registro: `ML-DEMO-${index + 1}`,
            },
          });
          await tx.perfilMl.create({
            data: {
              instituicaoId,
              matriculaId: matricula.id,
              features,
              fonte:
                'Seed demonstrativa autorizada — dois semestres; sem dados pessoais reais',
            },
          });
          if (tutor)
            await tx.tutoria.create({
              data: {
                instituicaoId,
                matriculaId: matricula.id,
                tutorId: tutor.id,
              },
            });
          for (let semester = 1; semester <= 2; semester++) {
            for (let unit = 1; unit <= 6; unit++) {
              const nome = `UC ${unit} — semestre ${semester}`;
              const disciplina = await tx.disciplina.upsert({
                where: {
                  instituicaoId_turmaId_nome: {
                    instituicaoId,
                    turmaId: turma.id,
                    nome,
                  },
                },
                create: { instituicaoId, turmaId: turma.id, nome },
                update: {},
              });
              if (teacher)
                await tx.lotacao.upsert({
                  where: {
                    instituicaoId_disciplinaId_professorId: {
                      instituicaoId,
                      disciplinaId: disciplina.id,
                      professorId: teacher.id,
                    },
                  },
                  create: {
                    instituicaoId,
                    disciplinaId: disciplina.id,
                    professorId: teacher.id,
                  },
                  update: {},
                });
              let avaliacao = await tx.avaliacao.findFirst({
                where: {
                  instituicaoId,
                  disciplinaId: disciplina.id,
                  titulo: 'Resultado final demonstrativo',
                },
              });
              const data = new Date(
                semester === 1
                  ? '2025-06-30T12:00:00Z'
                  : '2025-12-15T12:00:00Z',
              );
              avaliacao ??= await tx.avaliacao.create({
                data: {
                  instituicaoId,
                  disciplinaId: disciplina.id,
                  titulo: 'Resultado final demonstrativo',
                  peso: 1,
                  notaMaxima: 20,
                  data,
                  publicada: true,
                  publicadaEm: data,
                },
              });
              const valor =
                index === 0 ? 16 : semester === 1 && unit <= 2 ? 11 : 5;
              await tx.nota.create({
                data: {
                  instituicaoId,
                  matriculaId: matricula.id,
                  avaliacaoId: avaliacao.id,
                  valor,
                },
              });
            }
          }
        }
      },
      { timeout: 30000 },
    );
    process.stdout.write(
      'Seed ML concluída; cadastros existentes preservados. Previsões são executadas pelo modelo via API.\n',
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write(
    'Falha na seed ML; confira configuração e migrations.\n',
  );
  process.exitCode = 1;
});
