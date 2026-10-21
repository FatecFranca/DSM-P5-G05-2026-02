import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Perfil } from '../generated/prisma/enums';
import * as D from './academic.dto';
import {
  enrollmentScope,
  requireRole,
  subjectScope,
  writableSubject,
} from './academic.policy';

const fileSelect = { id: true, nome: true, mime: true, tamanho: true } as const;
const LIMIT = 2000;

@Injectable()
export class AcademicService {
  constructor(private readonly db: PrismaService) {}

  private async change<T>(
    actor: AuthUser,
    action: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const result = await work(tx);
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: action,
              recurso: 'ACADEMICO',
            },
          });
          return result;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Registro já cadastrado');
        if (error.code === 'P2034')
          throw new ConflictException(
            'Dados alterados em outra solicitação. Atualize e tente novamente.',
          );
      }
      throw error;
    }
  }

  classes(actor: AuthUser) {
    return this.db.turma.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        ...(['ADMIN', 'COORDENACAO'].includes(actor.perfil)
          ? {}
          : { disciplinas: { some: subjectScope(actor) } }),
      },
      orderBy: [{ periodo: 'desc' }, { nome: 'asc' }],
      take: LIMIT,
    });
  }

  async snapshot(actor: AuthUser, turmaId?: string) {
    const turmas = await this.classes(actor);
    const selected = turmaId ?? turmas[0]?.id;
    if (turmaId && !turmas.some((t) => t.id === turmaId))
      throw new NotFoundException('Turma não encontrada');
    const [disciplinas, matriculas] = await Promise.all([
      this.db.disciplina.findMany({
        where: {
          ...subjectScope(actor),
          turmaId: selected ?? '00000000-0000-0000-0000-000000000000',
        },
        orderBy: { nome: 'asc' },
        take: LIMIT,
      }),
      this.db.matricula.findMany({
        where: {
          ...enrollmentScope(actor),
          turmaId: selected ?? '00000000-0000-0000-0000-000000000000',
        },
        include: { aluno: { select: { nome: true } } },
        orderBy: { registro: 'asc' },
        take: LIMIT,
      }),
    ]);
    const where = {
      instituicaoId: actor.instituicaoId,
      disciplinaId: { in: disciplinas.map((d) => d.id) },
    };
    const publishedOnly = ['ALUNO', 'TUTOR'].includes(actor.perfil);
    const [aulas, avaliacoes, atividades, materiais] = await Promise.all([
      this.db.aula.findMany({ where, orderBy: { data: 'desc' }, take: LIMIT }),
      this.db.avaliacao.findMany({
        where: { ...where, ...(publishedOnly ? { publicada: true } : {}) },
        orderBy: { data: 'desc' },
        take: LIMIT,
      }),
      this.db.atividade.findMany({
        where: {
          ...where,
          ...(publishedOnly ? { estado: { not: 'RASCUNHO' as const } } : {}),
        },
        orderBy: { prazo: 'desc' },
        take: LIMIT,
      }),
      actor.perfil === 'TUTOR'
        ? Promise.resolve([])
        : this.db.material.findMany({
            where,
            include: { arquivo: { select: fileSelect } },
            orderBy: { criadoEm: 'desc' },
            take: LIMIT,
          }),
    ]);
    const studentWhere = {
      instituicaoId: actor.instituicaoId,
      matriculaId: { in: matriculas.map((m) => m.id) },
    };
    const [presencas, notas, entregas] = await Promise.all([
      this.db.presenca.findMany({
        where: { ...studentWhere, aulaId: { in: aulas.map((a) => a.id) } },
        take: LIMIT,
      }),
      this.db.nota.findMany({
        where: {
          ...studentWhere,
          avaliacaoId: { in: avaliacoes.map((a) => a.id) },
        },
        take: LIMIT,
      }),
      this.db.entrega.findMany({
        where: {
          ...studentWhere,
          atividadeId: { in: atividades.map((a) => a.id) },
        },
        include: { arquivo: { select: fileSelect } },
        take: LIMIT,
      }),
    ]);
    const truncated = [
      turmas,
      disciplinas,
      matriculas,
      aulas,
      avaliacoes,
      atividades,
      materiais,
      presencas,
      notas,
      entregas,
    ].some((rows) => rows.length === LIMIT);
    const indicadores = truncated
      ? []
      : matriculas.map((m) => {
          const attendance = presencas.filter((p) => p.matriculaId === m.id);
          const averages = disciplinas.flatMap((d) => {
            const published = avaliacoes.filter(
              (a) => a.disciplinaId === d.id && a.publicada,
            );
            const values = published.flatMap((a) => {
              const note = notas.find(
                (n) => n.avaliacaoId === a.id && n.matriculaId === m.id,
              );
              return note
                ? [{ value: (note.valor / a.notaMaxima) * 10, weight: a.peso }]
                : [];
            });
            return values.length
              ? [
                  values.reduce((s, v) => s + v.value * v.weight, 0) /
                    values.reduce((s, v) => s + v.weight, 0),
                ]
              : [];
          });
          return {
            matriculaId: m.id,
            media: averages.length
              ? averages.reduce((s, v) => s + v, 0) / averages.length
              : null,
            frequencia: attendance.length
              ? (attendance.filter((p) => p.situacao === 'PRESENTE').length /
                  attendance.length) *
                100
              : null,
          };
        });
    return {
      turmaId: selected ?? null,
      turmas,
      disciplinas,
      matriculas,
      aulas,
      presencas,
      avaliacoes,
      notas,
      atividades,
      entregas,
      materiais,
      indicadores,
      escala: 10,
      truncated,
    };
  }

  createClass(actor: AuthUser, dto: D.TurmaDto) {
    requireRole(actor, ['ADMIN']);
    return this.change(actor, 'CRIAR_TURMA', (tx) =>
      tx.turma.create({ data: { ...dto, instituicaoId: actor.instituicaoId } }),
    );
  }
  createSubject(actor: AuthUser, dto: D.DisciplinaDto) {
    requireRole(actor, ['ADMIN']);
    return this.change(actor, 'CRIAR_DISCIPLINA', async (tx) => {
      await this.openClass(tx, actor, dto.turmaId);
      return tx.disciplina.create({
        data: { ...dto, instituicaoId: actor.instituicaoId },
      });
    });
  }
  enroll(actor: AuthUser, dto: D.MatriculaDto) {
    requireRole(actor, ['ADMIN']);
    return this.change(actor, 'MATRICULAR_ALUNO', async (tx) => {
      await this.openClass(tx, actor, dto.turmaId);
      await this.userWithRole(tx, actor, dto.alunoId, 'ALUNO');
      return tx.matricula.create({
        data: { ...dto, instituicaoId: actor.instituicaoId },
      });
    });
  }
  assignTeacher(actor: AuthUser, dto: D.LotacaoDto) {
    requireRole(actor, ['ADMIN']);
    return this.change(actor, 'LOTAR_PROFESSOR', async (tx) => {
      const subject = await tx.disciplina.findFirst({
        where: { id: dto.disciplinaId, instituicaoId: actor.instituicaoId },
      });
      if (!subject) throw new NotFoundException('Disciplina não encontrada');
      await this.openClass(tx, actor, subject.turmaId);
      await this.userWithRole(tx, actor, dto.professorId, 'PROFESSOR');
      return tx.lotacao.create({
        data: { ...dto, instituicaoId: actor.instituicaoId },
      });
    });
  }
  assignTutor(actor: AuthUser, dto: D.TutoriaDto) {
    requireRole(actor, ['ADMIN']);
    return this.change(actor, 'VINCULAR_TUTOR', async (tx) => {
      const enrollment = await tx.matricula.findFirst({
        where: { id: dto.matriculaId, instituicaoId: actor.instituicaoId },
      });
      if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
      await this.openClass(tx, actor, enrollment.turmaId);
      await this.userWithRole(tx, actor, dto.tutorId, 'TUTOR');
      return tx.tutoria.create({
        data: { ...dto, instituicaoId: actor.instituicaoId },
      });
    });
  }
  closeClass(actor: AuthUser, id: string, fechada: boolean) {
    requireRole(actor, ['ADMIN']);
    return this.change(
      actor,
      fechada ? 'FECHAR_PERIODO' : 'REABRIR_PERIODO',
      async (tx) => {
        const turma = await tx.turma.findFirst({
          where: { id, instituicaoId: actor.instituicaoId },
        });
        if (!turma) throw new NotFoundException('Turma não encontrada');
        return tx.turma.update({
          where: {
            instituicaoId_id: { instituicaoId: actor.instituicaoId, id },
          },
          data: { fechada },
        });
      },
    );
  }
  createLesson(actor: AuthUser, dto: D.AulaDto) {
    return this.change(actor, 'CRIAR_AULA', async (tx) => {
      await writableSubject(tx, actor, dto.disciplinaId);
      return tx.aula.create({
        data: {
          ...dto,
          data: new Date(dto.data),
          instituicaoId: actor.instituicaoId,
        },
      });
    });
  }
  attendance(actor: AuthUser, id: string, dto: D.FrequenciaDto) {
    return this.change(actor, 'LANCAR_FREQUENCIA', async (tx) => {
      const aula = await tx.aula.findFirst({
        where: { id, instituicaoId: actor.instituicaoId },
      });
      if (!aula) throw new NotFoundException('Aula não encontrada');
      const subject = await writableSubject(tx, actor, aula.disciplinaId);
      const age = Date.now() - aula.data.getTime();
      if (age < 0 || age > 7 * 86400000)
        throw new ForbiddenException(
          'Frequência disponível até sete dias após a aula',
        );
      await this.validEnrollments(
        tx,
        actor,
        subject.turmaId,
        dto.itens.map((i) => i.matriculaId),
      );
      for (const item of dto.itens) {
        const key = {
          instituicaoId: actor.instituicaoId,
          aulaId: id,
          matriculaId: item.matriculaId,
        };
        await tx.presenca.upsert({
          where: { instituicaoId_aulaId_matriculaId: key },
          create: { ...key, situacao: item.situacao },
          update: { situacao: item.situacao },
        });
      }
      return { atualizados: dto.itens.length };
    });
  }
  createAssessment(actor: AuthUser, dto: D.AvaliacaoDto) {
    return this.change(actor, 'CRIAR_AVALIACAO', async (tx) => {
      await writableSubject(tx, actor, dto.disciplinaId);
      return tx.avaliacao.create({
        data: {
          ...dto,
          data: new Date(dto.data),
          instituicaoId: actor.instituicaoId,
        },
      });
    });
  }
  grades(actor: AuthUser, id: string, dto: D.NotasDto) {
    return this.change(actor, 'LANCAR_NOTAS', async (tx) => {
      const assessment = await tx.avaliacao.findFirst({
        where: { id, instituicaoId: actor.instituicaoId },
      });
      if (!assessment) throw new NotFoundException('Avaliação não encontrada');
      const subject = await writableSubject(tx, actor, assessment.disciplinaId);
      await this.validEnrollments(
        tx,
        actor,
        subject.turmaId,
        dto.itens.map((i) => i.matriculaId),
      );
      if (dto.itens.some((i) => i.valor > assessment.notaMaxima))
        throw new BadRequestException('Nota acima do máximo da avaliação');
      for (const item of dto.itens) {
        const key = {
          instituicaoId: actor.instituicaoId,
          avaliacaoId: id,
          matriculaId: item.matriculaId,
        };
        await tx.nota.upsert({
          where: { instituicaoId_avaliacaoId_matriculaId: key },
          create: { ...key, valor: item.valor },
          update: { valor: item.valor },
        });
      }
      return { atualizados: dto.itens.length };
    });
  }
  publishAssessment(actor: AuthUser, id: string) {
    return this.change(actor, 'PUBLICAR_NOTAS', async (tx) => {
      const assessment = await tx.avaliacao.findFirst({
        where: { id, instituicaoId: actor.instituicaoId },
      });
      if (!assessment) throw new NotFoundException('Avaliação não encontrada');
      const subject = await writableSubject(tx, actor, assessment.disciplinaId);
      if (assessment.publicada) return assessment;
      const missing = await tx.matricula.count({
        where: {
          instituicaoId: actor.instituicaoId,
          turmaId: subject.turmaId,
          notas: { none: { avaliacaoId: id } },
        },
      });
      if (missing)
        throw new BadRequestException(
          'Lance as notas de todos os alunos antes de publicar',
        );
      return tx.avaliacao.update({
        where: { instituicaoId_id: { instituicaoId: actor.instituicaoId, id } },
        data: {
          publicada: true,
          publicadaEm: assessment.publicadaEm ?? new Date(),
        },
      });
    });
  }
  createAssignment(actor: AuthUser, dto: D.AtividadeDto) {
    return this.change(actor, 'CRIAR_ATIVIDADE', async (tx) => {
      await writableSubject(tx, actor, dto.disciplinaId);
      if (
        new Date(dto.prazo).getTime() <= Date.now() ||
        dto.estado === 'ENCERRADA'
      )
        throw new BadRequestException(
          'Informe prazo futuro e estado inicial válido',
        );
      return tx.atividade.create({
        data: {
          ...dto,
          prazo: new Date(dto.prazo),
          publicadaEm: dto.estado === 'PUBLICADA' ? new Date() : null,
          instituicaoId: actor.instituicaoId,
        },
      });
    });
  }
  publishAssignment(actor: AuthUser, id: string) {
    return this.change(actor, 'PUBLICAR_ATIVIDADE', async (tx) => {
      const activity = await tx.atividade.findFirst({
        where: { id, instituicaoId: actor.instituicaoId },
      });
      if (!activity) throw new NotFoundException('Atividade não encontrada');
      await writableSubject(tx, actor, activity.disciplinaId);
      if (
        activity.estado !== 'RASCUNHO' ||
        activity.prazo.getTime() <= Date.now()
      )
        throw new BadRequestException('Atividade não pode ser publicada');
      return tx.atividade.update({
        where: { instituicaoId_id: { instituicaoId: actor.instituicaoId, id } },
        data: { estado: 'PUBLICADA', publicadaEm: new Date() },
      });
    });
  }
  submit(actor: AuthUser, id: string, dto: D.EntregaDto) {
    requireRole(actor, ['ALUNO']);
    return this.change(actor, 'ENTREGAR_ATIVIDADE', async (tx) => {
      const activity = await tx.atividade.findFirst({
        where: { id, instituicaoId: actor.instituicaoId },
        include: { disciplina: { include: { turma: true } } },
      });
      if (!activity) throw new NotFoundException('Atividade não encontrada');
      const enrollment = await tx.matricula.findFirst({
        where: {
          instituicaoId: actor.instituicaoId,
          alunoId: actor.id,
          turmaId: activity.disciplina.turmaId,
        },
      });
      if (!enrollment) throw new NotFoundException('Atividade não encontrada');
      if (
        activity.estado !== 'PUBLICADA' ||
        activity.prazo.getTime() <= Date.now() ||
        activity.disciplina.turma.fechada
      )
        throw new ForbiddenException('Entrega indisponível');
      await this.ownedFile(tx, actor, dto.arquivoId);
      const key = {
        instituicaoId: actor.instituicaoId,
        atividadeId: id,
        matriculaId: enrollment.id,
      };
      const previous = await tx.entrega.findUnique({
        where: { instituicaoId_atividadeId_matriculaId: key },
      });
      if (previous?.corrigidaEm)
        throw new ForbiddenException('Entrega já corrigida');
      return tx.entrega.upsert({
        where: { instituicaoId_atividadeId_matriculaId: key },
        create: { ...key, arquivoId: dto.arquivoId },
        update: { arquivoId: dto.arquivoId, enviadaEm: new Date() },
      });
    });
  }
  correct(
    actor: AuthUser,
    id: string,
    matriculaId: string,
    dto: D.CorrecaoDto,
  ) {
    return this.change(actor, 'CORRIGIR_ENTREGA', async (tx) => {
      const activity = await tx.atividade.findFirst({
        where: { id, instituicaoId: actor.instituicaoId },
      });
      if (!activity) throw new NotFoundException('Atividade não encontrada');
      await writableSubject(tx, actor, activity.disciplinaId);
      if (dto.nota > activity.notaMaxima)
        throw new BadRequestException('Nota acima do máximo da atividade');
      const key = {
        instituicaoId: actor.instituicaoId,
        atividadeId: id,
        matriculaId,
      };
      if (
        !(await tx.entrega.findUnique({
          where: { instituicaoId_atividadeId_matriculaId: key },
        }))
      )
        throw new NotFoundException('Entrega não encontrada');
      return tx.entrega.update({
        where: { instituicaoId_atividadeId_matriculaId: key },
        data: { ...dto, corrigidaEm: new Date() },
      });
    });
  }
  createMaterial(actor: AuthUser, dto: D.MaterialDto) {
    return this.change(actor, 'PUBLICAR_MATERIAL', async (tx) => {
      await writableSubject(tx, actor, dto.disciplinaId);
      await this.ownedFile(tx, actor, dto.arquivoId);
      return tx.material.create({
        data: { ...dto, instituicaoId: actor.instituicaoId },
      });
    });
  }
  private async ownedFile(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    id: string,
  ) {
    if (
      !(await tx.arquivo.findFirst({
        where: { id, instituicaoId: actor.instituicaoId, autorId: actor.id },
      }))
    )
      throw new NotFoundException('Arquivo não encontrado');
  }
  private async openClass(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    id: string,
  ) {
    const turma = await tx.turma.findFirst({
      where: { id, instituicaoId: actor.instituicaoId },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada');
    if (turma.fechada) throw new ForbiddenException('Período da turma fechado');
    return turma;
  }
  private async userWithRole(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    id: string,
    perfil: Perfil,
  ) {
    if (
      !(await tx.usuario.findFirst({
        where: { id, instituicaoId: actor.instituicaoId, perfil, ativo: true },
      }))
    )
      throw new NotFoundException(
        'Usuário com perfil requerido não encontrado',
      );
  }
  private async validEnrollments(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    turmaId: string,
    ids: string[],
  ) {
    const count = await tx.matricula.count({
      where: { instituicaoId: actor.instituicaoId, turmaId, id: { in: ids } },
    });
    if (count !== ids.length)
      throw new BadRequestException('Matrícula inválida para esta turma');
  }
}
