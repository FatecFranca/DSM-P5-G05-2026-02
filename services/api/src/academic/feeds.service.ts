import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import type { CalendarioQuery, FeedQuery } from './academic.dto';
import { enrollmentScope, subjectScope } from './academic.policy';
import { feedPage, type AcademicEvent } from './feed-page';

const disciplinaSelect = { select: { id: true, nome: true } } as const;
function event(
  tipo: AcademicEvent['tipo'],
  id: string,
  titulo: string,
  data: Date,
  disciplina: { id: string; nome: string },
): AcademicEvent {
  return {
    id: `${tipo}:${id}`,
    recursoId: id,
    tipo,
    titulo,
    data,
    disciplinaId: disciplina.id,
    disciplina: disciplina.nome,
  };
}

@Injectable()
export class FeedsService {
  constructor(private readonly db: PrismaService) {}
  private scope(actor: AuthUser, query: FeedQuery) {
    return {
      ...subjectScope(actor),
      ...(query.turmaId ? { turmaId: query.turmaId } : {}),
      ...(query.disciplinaId ? { id: query.disciplinaId } : {}),
    };
  }
  async calendar(actor: AuthUser, query: CalendarioQuery) {
    const start = new Date(query.inicio),
      end = new Date(query.fim);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start ||
      end.getTime() - start.getTime() > 93 * 86400000
    )
      throw new BadRequestException(
        'Informe um intervalo crescente de até 93 dias',
      );
    const where = {
      instituicaoId: actor.instituicaoId,
      disciplina: this.scope(actor, query),
    };
    const range = { gte: start, lt: end };
    const take = query.pagina * query.tamanho + 1;
    const publishedOnly = actor.perfil === 'ALUNO' || actor.perfil === 'TUTOR';
    const [lessons, exams, assignments] = await Promise.all([
      this.db.aula.findMany({
        where: { ...where, data: range },
        select: {
          id: true,
          tema: true,
          data: true,
          disciplina: disciplinaSelect,
        },
        orderBy: [{ data: 'asc' }, { id: 'asc' }],
        take,
      }),
      this.db.avaliacao.findMany({
        where: {
          ...where,
          data: range,
          ...(publishedOnly ? { publicada: true } : {}),
        },
        select: {
          id: true,
          titulo: true,
          data: true,
          disciplina: disciplinaSelect,
        },
        orderBy: [{ data: 'asc' }, { id: 'asc' }],
        take,
      }),
      this.db.atividade.findMany({
        where: {
          ...where,
          prazo: range,
          ...(publishedOnly ? { estado: { not: 'RASCUNHO' as const } } : {}),
        },
        select: {
          id: true,
          titulo: true,
          prazo: true,
          disciplina: disciplinaSelect,
        },
        orderBy: [{ prazo: 'asc' }, { id: 'asc' }],
        take,
      }),
    ]);
    return feedPage(
      [
        ...lessons.map((r) =>
          event('AULA', r.id, r.tema, r.data, r.disciplina),
        ),
        ...exams.map((r) =>
          event('AVALIACAO', r.id, r.titulo, r.data, r.disciplina),
        ),
        ...assignments.map((r) =>
          event('ENTREGA', r.id, r.titulo, r.prazo, r.disciplina),
        ),
      ],
      query.pagina,
      query.tamanho,
    );
  }
  async notices(actor: AuthUser, query: FeedQuery) {
    const where = {
      instituicaoId: actor.instituicaoId,
      disciplina: this.scope(actor, query),
    };
    const take = query.pagina * query.tamanho + 1;
    const [materials, assignments, exams, corrections] = await Promise.all([
      actor.perfil === 'TUTOR'
        ? Promise.resolve([])
        : this.db.material.findMany({
            where,
            select: {
              id: true,
              titulo: true,
              criadoEm: true,
              disciplina: disciplinaSelect,
            },
            orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }],
            take,
          }),
      this.db.atividade.findMany({
        where: {
          ...where,
          estado: { not: 'RASCUNHO' },
          publicadaEm: { not: null },
        },
        select: {
          id: true,
          titulo: true,
          publicadaEm: true,
          disciplina: disciplinaSelect,
        },
        orderBy: [{ publicadaEm: 'desc' }, { id: 'asc' }],
        take,
      }),
      this.db.avaliacao.findMany({
        where: { ...where, publicada: true, publicadaEm: { not: null } },
        select: {
          id: true,
          titulo: true,
          publicadaEm: true,
          disciplina: disciplinaSelect,
        },
        orderBy: [{ publicadaEm: 'desc' }, { id: 'asc' }],
        take,
      }),
      this.db.entrega.findMany({
        where: {
          instituicaoId: actor.instituicaoId,
          matricula: enrollmentScope(actor),
          corrigidaEm: { not: null },
          atividade: { ...where, estado: { not: 'RASCUNHO' } },
        },
        select: {
          atividadeId: true,
          matriculaId: true,
          corrigidaEm: true,
          atividade: { select: { titulo: true, disciplina: disciplinaSelect } },
        },
        orderBy: [
          { corrigidaEm: 'desc' },
          { atividadeId: 'asc' },
          { matriculaId: 'asc' },
        ],
        take,
      }),
    ]);
    return feedPage(
      [
        ...materials.map((r) =>
          event('MATERIAL', r.id, r.titulo, r.criadoEm, r.disciplina),
        ),
        ...assignments.flatMap((r) =>
          r.publicadaEm
            ? [event('ATIVIDADE', r.id, r.titulo, r.publicadaEm, r.disciplina)]
            : [],
        ),
        ...exams.flatMap((r) =>
          r.publicadaEm
            ? [event('NOTAS', r.id, r.titulo, r.publicadaEm, r.disciplina)]
            : [],
        ),
        ...corrections.flatMap((r) =>
          r.corrigidaEm
            ? [
                event(
                  'CORRECAO',
                  `${r.atividadeId}:${r.matriculaId}`,
                  r.atividade.titulo,
                  r.corrigidaEm,
                  r.atividade.disciplina,
                ),
              ]
            : [],
        ),
      ],
      query.pagina,
      query.tamanho,
      true,
    );
  }
}
