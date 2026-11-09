import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { requireRole } from './academic.policy';

/**
 * Quem faz parte de uma turma: disciplinas com seus docentes e estudantes com seus tutores. É o que a
 * gestão precisa para vincular pessoas à turma e o que docentes e tutores precisam para saber com quem
 * trabalham. A resposta já diz o que o perfil pode fazer (`permissoes`), para o app não repetir regras.
 */
@Injectable()
export class ParticipantsService {
  constructor(private readonly db: PrismaService) {}

  private visibility(actor: AuthUser): Prisma.TurmaWhereInput {
    if (actor.perfil === 'PROFESSOR') {
      return {
        disciplinas: {
          some: { lotacoes: { some: { professorId: actor.id } } },
        },
      };
    }
    if (actor.perfil === 'TUTOR') {
      return {
        matriculas: { some: { tutorias: { some: { tutorId: actor.id } } } },
      };
    }
    return {};
  }

  async list(actor: AuthUser, turmaId: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR']);
    const turma = await this.db.turma.findFirst({
      where: {
        id: turmaId,
        instituicaoId: actor.instituicaoId,
        ...this.visibility(actor),
      },
      select: {
        id: true,
        nome: true,
        curso: true,
        periodo: true,
        fechada: true,
        disciplinas: {
          orderBy: { nome: 'asc' },
          select: {
            id: true,
            nome: true,
            lotacoes: {
              select: {
                professor: {
                  select: { id: true, nome: true, email: true, ativo: true },
                },
              },
            },
          },
        },
        matriculas: {
          // O tutor vê apenas os estudantes que acompanha.
          where:
            actor.perfil === 'TUTOR'
              ? { tutorias: { some: { tutorId: actor.id } } }
              : {},
          select: {
            id: true,
            registro: true,
            aluno: {
              select: { id: true, nome: true, email: true, ativo: true },
            },
            tutorias: {
              select: { tutor: { select: { id: true, nome: true } } },
            },
          },
        },
      },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    const coordination = actor.perfil === 'COORDENACAO';
    const manager = coordination || actor.perfil === 'SECRETARIA';
    const open = !turma.fechada;
    const byName = (a: { nome: string }, b: { nome: string }) =>
      a.nome.localeCompare(b.nome, 'pt-BR');
    return {
      turma: {
        id: turma.id,
        nome: turma.nome,
        curso: turma.curso,
        periodo: turma.periodo,
        fechada: turma.fechada,
      },
      disciplinas: turma.disciplinas.map((disciplina) => ({
        id: disciplina.id,
        nome: disciplina.nome,
        docentes: disciplina.lotacoes
          .map((lotacao) => lotacao.professor)
          .sort(byName),
      })),
      estudantes: turma.matriculas
        .map((matricula) => ({
          matriculaId: matricula.id,
          registro: matricula.registro,
          aluno: matricula.aluno,
          tutores: matricula.tutorias.map((item) => item.tutor).sort(byName),
        }))
        .sort((a, b) => byName(a.aluno, b.aluno)),
      // Período fechado trava toda alteração de vínculo.
      permissoes: {
        criarDisciplina: coordination && open,
        vincularDocente: coordination && open,
        vincularTutor: coordination && open,
        matricular: manager && open,
        removerMatricula: manager && open,
      },
    };
  }
}
