import type { AuthUser } from '../auth/auth-user';
import type { Prisma } from '../generated/prisma/client';

// Escopo das consultas: o que cada perfil enxerga de turmas, disciplinas e publicações de canal.
// Reaproveitado pelo acesso a arquivos, para que um anexo só seja lido por quem vê a mensagem.

/** Turmas cujos canais o perfil lê. `null` = nenhuma. */
export function turmaAccess(actor: AuthUser): Prisma.TurmaWhereInput | null {
  switch (actor.perfil) {
    case 'ALUNO':
      return { matriculas: { some: { alunoId: actor.id } } };
    case 'TUTOR':
      return {
        matriculas: { some: { tutorias: { some: { tutorId: actor.id } } } },
      };
    case 'PROFESSOR':
      return {
        disciplinas: {
          some: { lotacoes: { some: { professorId: actor.id } } },
        },
      };
    default:
      return null;
  }
}

/** Disciplinas (dentro das turmas acessíveis) cujo canal o perfil lê: o docente só as que leciona. */
export function channelDisciplines(
  actor: AuthUser,
): Prisma.DisciplinaWhereInput {
  return actor.perfil === 'PROFESSOR'
    ? { lotacoes: { some: { professorId: actor.id } } }
    : {};
}

/** Publicações de canal que o perfil pode ver, ou `null` se ele não lê canais. */
export function channelPostWhere(
  actor: AuthUser,
): Prisma.PublicacaoWhereInput | null {
  const turma = turmaAccess(actor);
  if (!turma) return null;
  const base = { instituicaoId: actor.instituicaoId, turma };
  // Só o docente é limitado às disciplinas que leciona. Para os demais não se filtra a disciplina:
  // um filtro de relação vazio (`disciplina: {}`) não casa com publicações de canal de disciplina.
  return actor.perfil === 'PROFESSOR'
    ? {
        ...base,
        OR: [{ disciplinaId: null }, { disciplina: channelDisciplines(actor) }],
      }
    : base;
}
