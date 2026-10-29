import * as argon2 from 'argon2';
import type { PrismaClient } from './generated/prisma/client';
import { Perfil } from './generated/prisma/enums';
import type { readDevSeedConfig } from './config/dev-seed-config';

type DevSeedConfig = ReturnType<typeof readDevSeedConfig>;

const institutions = [
  {
    codigo: '109',
    usuarios: [
      {
        email: 'admin.demo@sgei.example',
        nome: 'Administração Demo',
        perfil: Perfil.ADMIN,
      },
      {
        email: 'coordenacao.demo@sgei.example',
        nome: 'Coordenação Demo',
        perfil: Perfil.COORDENACAO,
      },
      {
        email: 'professor.demo@sgei.example',
        nome: 'Professor Demo',
        perfil: Perfil.PROFESSOR,
      },
      {
        email: 'tutor.demo@sgei.example',
        nome: 'Tutor Demo',
        perfil: Perfil.TUTOR,
      },
      {
        email: 'aluno.demo@sgei.example',
        nome: 'Estudante Demo 1',
        perfil: Perfil.ALUNO,
      },
      {
        email: 'aluno2.franca@sgei.example',
        nome: 'Estudante Demo 2',
        perfil: Perfil.ALUNO,
      },
    ],
  },
  ...(['002', '276', '284'] as const).map((codigo) => ({
    codigo,
    usuarios: [
      {
        email: `professor.${codigo}@sgei.example`,
        nome: `Professor Demo ${codigo}`,
        perfil: Perfil.PROFESSOR,
      },
      {
        email: `tutor.${codigo}@sgei.example`,
        nome: `Tutor Demo ${codigo}`,
        perfil: Perfil.TUTOR,
      },
      {
        email: `aluno.${codigo}@sgei.example`,
        nome: `Estudante Demo ${codigo}`,
        perfil: Perfil.ALUNO,
      },
    ],
  })),
] as const;

export async function seedDevelopment(
  prisma: PrismaClient,
  config: DevSeedConfig,
) {
  const passwordHashes = {
    ADMIN: await argon2.hash(config.passwords.ADMIN, { type: argon2.argon2id }),
    COORDENACAO: await argon2.hash(config.passwords.COORDENACAO, {
      type: argon2.argon2id,
    }),
    PROFESSOR: await argon2.hash(config.passwords.PROFESSOR, {
      type: argon2.argon2id,
    }),
    TUTOR: await argon2.hash(config.passwords.TUTOR, { type: argon2.argon2id }),
    ALUNO: await argon2.hash(config.passwords.ALUNO, { type: argon2.argon2id }),
  };

  for (const entry of institutions) {
    const institution = await prisma.instituicao.findUnique({
      where: { codigoCps: entry.codigo },
      select: { id: true },
    });
    if (!institution) throw new Error(`Fatec ${entry.codigo} não encontrada`);

    const instituicaoId = institution.id;
    await prisma.$transaction(
      async (tx) => {
        const users = new Map<string, string>();
        for (const user of entry.usuarios) {
          const existing = await tx.usuario.findUnique({
            where: {
              instituicaoId_email: { instituicaoId, email: user.email },
            },
            select: { id: true, perfil: true },
          });
          if (existing && existing.perfil !== user.perfil) {
            throw new Error(`Perfil divergente para ${user.email}`);
          }
          const record =
            existing ??
            (await tx.usuario.create({
              data: {
                instituicaoId,
                email: user.email,
                nome: user.nome,
                perfil: user.perfil,
                senhaHash: passwordHashes[user.perfil],
              },
              select: { id: true, perfil: true },
            }));
          users.set(user.email, record.id);
        }

        const turma = await tx.turma.upsert({
          where: {
            instituicaoId_nome_periodo: {
              instituicaoId,
              nome: 'Turma demonstrativa',
              periodo: '2026/2',
            },
          },
          create: {
            instituicaoId,
            nome: 'Turma demonstrativa',
            periodo: '2026/2',
            curso: 'Curso demonstrativo',
          },
          update: {},
          select: { id: true },
        });
        const disciplina = await tx.disciplina.upsert({
          where: {
            instituicaoId_turmaId_nome: {
              instituicaoId,
              turmaId: turma.id,
              nome: 'Fundamentos de programação (demonstração)',
            },
          },
          create: {
            instituicaoId,
            turmaId: turma.id,
            nome: 'Fundamentos de programação (demonstração)',
          },
          update: {},
          select: { id: true },
        });
        const professor = entry.usuarios.find(
          (user) => user.perfil === Perfil.PROFESSOR,
        )!;
        const tutor = entry.usuarios.find(
          (user) => user.perfil === Perfil.TUTOR,
        )!;
        await tx.lotacao.upsert({
          where: {
            instituicaoId_disciplinaId_professorId: {
              instituicaoId,
              disciplinaId: disciplina.id,
              professorId: users.get(professor.email)!,
            },
          },
          create: {
            instituicaoId,
            disciplinaId: disciplina.id,
            professorId: users.get(professor.email)!,
          },
          update: {},
        });

        const lessonDate = new Date('2026-09-01T12:00:00Z');
        const lessonTheme = 'Introdução (demonstração)';
        const aula =
          (await tx.aula.findFirst({
            where: {
              instituicaoId,
              disciplinaId: disciplina.id,
              data: lessonDate,
              tema: lessonTheme,
            },
            select: { id: true },
          })) ??
          (await tx.aula.create({
            data: {
              instituicaoId,
              disciplinaId: disciplina.id,
              data: lessonDate,
              tema: lessonTheme,
            },
            select: { id: true },
          }));
        const evaluationTitle = 'Avaliação demonstrativa';
        const avaliacao =
          (await tx.avaliacao.findFirst({
            where: {
              instituicaoId,
              disciplinaId: disciplina.id,
              titulo: evaluationTitle,
            },
            select: { id: true },
          })) ??
          (await tx.avaliacao.create({
            data: {
              instituicaoId,
              disciplinaId: disciplina.id,
              titulo: evaluationTitle,
              peso: 1,
              notaMaxima: 10,
              data: new Date('2026-09-15T12:00:00Z'),
              publicada: true,
              publicadaEm: new Date('2026-09-15T12:00:00Z'),
            },
            select: { id: true },
          }));

        const students = entry.usuarios.filter(
          (user) => user.perfil === Perfil.ALUNO,
        );
        for (const [index, student] of students.entries()) {
          const alunoId = users.get(student.email)!;
          const registro = `DEV-${entry.codigo}-${index + 1}`;
          const existing = await tx.matricula.findUnique({
            where: { instituicaoId_registro: { instituicaoId, registro } },
            select: { id: true, alunoId: true, turmaId: true },
          });
          if (
            existing &&
            (existing.alunoId !== alunoId || existing.turmaId !== turma.id)
          ) {
            throw new Error(`Matrícula divergente para ${registro}`);
          }
          const matricula =
            existing ??
            (await tx.matricula.create({
              data: { instituicaoId, turmaId: turma.id, alunoId, registro },
              select: { id: true, alunoId: true, turmaId: true },
            }));
          await tx.tutoria.upsert({
            where: {
              instituicaoId_matriculaId_tutorId: {
                instituicaoId,
                matriculaId: matricula.id,
                tutorId: users.get(tutor.email)!,
              },
            },
            create: {
              instituicaoId,
              matriculaId: matricula.id,
              tutorId: users.get(tutor.email)!,
            },
            update: {},
          });
          await tx.presenca.upsert({
            where: {
              instituicaoId_aulaId_matriculaId: {
                instituicaoId,
                aulaId: aula.id,
                matriculaId: matricula.id,
              },
            },
            create: {
              instituicaoId,
              aulaId: aula.id,
              matriculaId: matricula.id,
              situacao: index === 0 ? 'PRESENTE' : 'FALTA',
            },
            update: {},
          });
          await tx.nota.upsert({
            where: {
              instituicaoId_avaliacaoId_matriculaId: {
                instituicaoId,
                avaliacaoId: avaliacao.id,
                matriculaId: matricula.id,
              },
            },
            create: {
              instituicaoId,
              avaliacaoId: avaliacao.id,
              matriculaId: matricula.id,
              valor: index === 0 ? 8 : 6,
            },
            update: {},
          });
        }
      },
      { timeout: 30000 },
    );
  }
}
