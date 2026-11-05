import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import type { Prisma } from '../generated/prisma/client';

export function requireRole(actor: AuthUser, roles: readonly string[]) {
  if (!roles.includes(actor.perfil)) throw new ForbiddenException();
}

export function enrollmentScope(actor: AuthUser): Prisma.MatriculaWhereInput {
  const tenant = { instituicaoId: actor.instituicaoId };
  switch (actor.perfil) {
    case 'ADMIN':
    case 'SECRETARIA':
    case 'COORDENACAO':
      return tenant;
    case 'ALUNO':
      return { ...tenant, alunoId: actor.id };
    case 'TUTOR':
      return { ...tenant, tutorias: { some: { tutorId: actor.id } } };
    case 'PROFESSOR':
      return {
        ...tenant,
        turma: {
          disciplinas: {
            some: { lotacoes: { some: { professorId: actor.id } } },
          },
        },
      };
    case 'FINANCEIRO':
      throw new ForbiddenException();
  }
}

export function subjectScope(actor: AuthUser): Prisma.DisciplinaWhereInput {
  if (actor.perfil === 'PROFESSOR') {
    return {
      instituicaoId: actor.instituicaoId,
      lotacoes: { some: { professorId: actor.id } },
    };
  }
  if (actor.perfil === 'FINANCEIRO') throw new ForbiddenException();
  if (
    actor.perfil === 'ADMIN' ||
    actor.perfil === 'SECRETARIA' ||
    actor.perfil === 'COORDENACAO'
  ) {
    return { instituicaoId: actor.instituicaoId };
  }
  return {
    instituicaoId: actor.instituicaoId,
    turma: { matriculas: { some: enrollmentScope(actor) } },
  };
}

export async function writableSubject(
  tx: Prisma.TransactionClient,
  actor: AuthUser,
  id: string,
) {
  requireRole(actor, ['PROFESSOR']);
  const subject = await tx.disciplina.findFirst({
    where: { ...subjectScope(actor), id },
    include: { turma: true },
  });
  if (!subject) throw new NotFoundException('Disciplina não encontrada');
  if (subject.turma.fechada)
    throw new ForbiddenException('Período da turma fechado');
  return subject;
}
