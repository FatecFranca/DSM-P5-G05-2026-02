import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { requireRole } from '../academic/academic.policy';
import { Prisma } from '../generated/prisma/client';
import { SituacaoFatura } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { recordAttributeChanges } from '../ml/attribute-events';
import { randomUUID } from 'node:crypto';
import {
  CreateInvoiceDto,
  MonthlyPlanDto,
  RecordPaymentDto,
} from './billing.dto';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function businessDate(now: Date): Date {
  const parts = DATE_FORMATTER.formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return new Date(
    `${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`,
  );
}

function dateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Data de vencimento inválida');
  return parsed;
}

function invoiceState(due: Date, paid: number, total: number, today: Date) {
  if (paid === total) return SituacaoFatura.QUITADA;
  return due < today ? SituacaoFatura.VENCIDA : SituacaoFatura.ABERTA;
}

function nextMonth(month: Date): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
}

export function semesterForMonth(start: Date, month: Date): number {
  const months =
    (month.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    month.getUTCMonth() -
    start.getUTCMonth();
  if (months < 0)
    throw new BadRequestException('Competência anterior ao início do curso');
  return Math.floor(months / 6) + 1;
}

export function monthlyDue(month: Date, day: number): Date {
  const lastDay = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      month.getUTCFullYear(),
      month.getUTCMonth(),
      Math.min(day, lastDay),
    ),
  );
}

@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly db: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.runSweep(), 15 * 60_000);
    this.timer.unref();
    this.runSweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private runSweep() {
    void this.processMonthly()
      .then(() => this.processOverdue())
      .catch((error: unknown) => {
        this.logger.error(
          'Falha ao atualizar mensalidades e vencimentos',
          error,
        );
      });
  }

  async setMonthlyPlan(
    actor: AuthUser,
    matriculaId: string,
    dto: MonthlyPlanDto,
  ) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    const start = dateOnly(`${dto.inicioCompetencia}-01`);
    const requestedEnd = dto.fimCompetencia
      ? dateOnly(`${dto.fimCompetencia}-01`)
      : null;
    if (requestedEnd && requestedEnd < start)
      throw new BadRequestException('Competência final anterior à inicial');
    const plan = await this.db.$transaction(
      async (tx) => {
        const enrollment = await tx.matricula.findFirst({
          where: { id: matriculaId, instituicaoId: actor.instituicaoId },
          select: { id: true, turma: { select: { duracaoSemestres: true } } },
        });
        if (!enrollment)
          throw new NotFoundException('Matrícula não encontrada');
        const courseEnd = new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth() + enrollment.turma.duracaoSemestres * 6 - 1,
            1,
          ),
        );
        if (requestedEnd && requestedEnd > courseEnd)
          throw new BadRequestException('Plano excede a duração do curso');
        const end = requestedEnd ?? courseEnd;
        const values = {
          inicioCompetencia: start,
          proximaCompetencia: start,
          fimCompetencia: end,
          valorCentavos: dto.valorCentavos,
          diaVencimento: dto.diaVencimento,
          ativo: dto.ativo,
        };
        const saved = await tx.planoMensalidade.upsert({
          where: { matriculaId },
          create: {
            ...values,
            matriculaId,
            instituicaoId: actor.instituicaoId,
          },
          update: values,
        });
        await tx.auditoria.create({
          data: {
            instituicaoId: actor.instituicaoId,
            autorId: actor.id,
            acao: 'CONFIGURAR_MENSALIDADE',
            recurso: 'MATRICULA',
            recursoId: matriculaId,
          },
        });
        return saved;
      },
      { isolationLevel: 'Serializable' },
    );
    this.runSweep();
    return plan;
  }

  async processMonthly(now = new Date()) {
    const today = businessDate(now);
    const currentMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const plans = await this.db.planoMensalidade.findMany({
      where: { ativo: true, proximaCompetencia: { lte: currentMonth } },
      select: { matriculaId: true },
      orderBy: { proximaCompetencia: 'asc' },
      take: 100,
    });
    let created = 0;
    for (const plan of plans) {
      for (let index = 0; index < 36; index += 1) {
        const result = await this.db.$transaction(
          async (tx) => {
            const current = await tx.planoMensalidade.findUnique({
              where: { matriculaId: plan.matriculaId },
            });
            if (
              !current ||
              !current.ativo ||
              current.proximaCompetencia > currentMonth ||
              (current.fimCompetencia &&
                current.proximaCompetencia > current.fimCompetencia)
            )
              return { done: true, created: false };
            const month = current.proximaCompetencia;
            const due = monthlyDue(month, current.diaVencimento);
            const existing = await tx.fatura.findUnique({
              where: {
                instituicaoId_matriculaId_competencia: {
                  instituicaoId: current.instituicaoId,
                  matriculaId: current.matriculaId,
                  competencia: month,
                },
              },
            });
            let invoice = existing;
            if (!invoice) {
              invoice = await tx.fatura.create({
                data: {
                  instituicaoId: current.instituicaoId,
                  matriculaId: current.matriculaId,
                  competencia: month,
                  semestre: semesterForMonth(current.inicioCompetencia, month),
                  vencimento: due,
                  valorCentavos: current.valorCentavos,
                  situacao: invoiceState(due, 0, current.valorCentavos, today),
                },
              });
            }
            const advanced = await tx.planoMensalidade.updateMany({
              where: {
                matriculaId: current.matriculaId,
                proximaCompetencia: month,
              },
              data: {
                proximaCompetencia: nextMonth(month),
                ativo: current.fimCompetencia
                  ? nextMonth(month) <= current.fimCompetencia
                  : true,
              },
            });
            if (advanced.count !== 1)
              throw new ConflictException(
                'Mensalidade alterada durante a geração',
              );
            if (!existing) {
              await this.updateFinancialFeatures(
                tx,
                current.instituicaoId,
                current.matriculaId,
                today,
              );
              await tx.auditoria.create({
                data: {
                  instituicaoId: current.instituicaoId,
                  acao: 'GERAR_FATURA_MENSAL',
                  recurso: 'FATURA',
                  recursoId: invoice.id,
                },
              });
            }
            return { done: false, created: !existing };
          },
          { isolationLevel: 'Serializable' },
        );
        if (result.done) break;
        if (result.created) created += 1;
      }
    }
    return created;
  }

  private async updateFinancialFeatures(
    tx: Prisma.TransactionClient,
    instituicaoId: string,
    matriculaId: string,
    today: Date,
    autorId?: string,
  ) {
    const pending = await tx.fatura.findMany({
      where: { instituicaoId, matriculaId, situacao: { not: 'QUITADA' } },
      select: { vencimento: true, valorCentavos: true, pagoCentavos: true },
    });
    const overdue = pending.some(
      (invoice) =>
        invoice.vencimento < today &&
        invoice.pagoCentavos < invoice.valorCentavos,
    );
    const financial = {
      devedor: overdue ? 1 : 0,
      mensalidade_em_dia: overdue ? 0 : 1,
    };
    const profile = await tx.perfilMl.findUnique({ where: { matriculaId } });
    const existing = (profile?.features ?? {}) as Record<string, number>;
    if (
      profile &&
      existing.devedor === financial.devedor &&
      existing.mensalidade_em_dia === financial.mensalidade_em_dia
    )
      return;
    if (profile) {
      const updated = await tx.perfilMl.updateMany({
        where: { matriculaId, instituicaoId, versao: profile.versao },
        data: {
          features: { ...existing, ...financial },
          versao: { increment: 1 },
          resultado: Prisma.DbNull,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Perfil alterado durante a atualização');
    } else {
      await tx.perfilMl.create({
        data: {
          instituicaoId,
          matriculaId,
          features: financial,
          fonte: 'Financeiro institucional',
        },
      });
    }
    await recordAttributeChanges(tx, {
      instituicaoId,
      matriculaId,
      before: existing,
      after: { ...existing, ...financial },
      versaoPerfil: profile ? profile.versao + 1 : 1,
      origem: 'FINANCEIRO',
      autorId,
    });
  }

  async create(actor: AuthUser, dto: CreateInvoiceDto) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    const today = businessDate(new Date());
    const due = dateOnly(dto.vencimento);
    const month = dateOnly(`${dto.competencia}-01`);
    try {
      return await this.db.$transaction(
        async (tx) => {
          const enrollment = await tx.matricula.findFirst({
            where: { id: dto.matriculaId, instituicaoId: actor.instituicaoId },
            select: { id: true, turma: { select: { duracaoSemestres: true } } },
          });
          if (!enrollment)
            throw new NotFoundException('Matrícula não encontrada');
          const plan = await tx.planoMensalidade.findUnique({
            where: { matriculaId: dto.matriculaId },
            select: { inicioCompetencia: true },
          });
          const semestre = plan
            ? semesterForMonth(plan.inicioCompetencia, month)
            : (dto.semestre ?? null);
          if (plan && dto.semestre && dto.semestre !== semestre)
            throw new BadRequestException(
              'Semestre não corresponde à competência do plano',
            );
          if (semestre && semestre > enrollment.turma.duracaoSemestres)
            throw new BadRequestException('Semestre excede a duração do curso');
          const invoice = await tx.fatura.create({
            data: {
              instituicaoId: actor.instituicaoId,
              matriculaId: dto.matriculaId,
              competencia: month,
              semestre,
              vencimento: due,
              valorCentavos: dto.valorCentavos,
              situacao: invoiceState(due, 0, dto.valorCentavos, today),
            },
          });
          await this.updateFinancialFeatures(
            tx,
            actor.instituicaoId,
            dto.matriculaId,
            today,
            actor.id,
          );
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'CRIAR_FATURA',
              recurso: 'FATURA',
              recursoId: invoice.id,
            },
          });
          return invoice;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Fatura da competência já cadastrada');
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'Dados alterados simultaneamente; tente novamente',
        );
      throw error;
    }
  }

  async recordPayment(
    actor: AuthUser,
    id: string,
    dto: RecordPaymentDto,
    now = new Date(),
  ) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    return this.registerPayment(actor, id, dto, now, false);
  }

  async simulatePayment(actor: AuthUser, id: string, now = new Date()) {
    requireRole(actor, ['ALUNO']);
    if (process.env.SIMULATED_PAYMENTS_ENABLED !== 'true')
      throw new ForbiddenException('Pagamento simulado desabilitado');
    const invoice = await this.db.fatura.findFirst({
      where: {
        id,
        instituicaoId: actor.instituicaoId,
        matricula: { alunoId: actor.id },
      },
      select: { valorCentavos: true, pagoCentavos: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    const remaining = invoice.valorCentavos - invoice.pagoCentavos;
    if (remaining <= 0) throw new ConflictException('Fatura já quitada');
    return this.registerPayment(
      actor,
      id,
      {
        referencia: `SIM-${randomUUID()}`,
        valorCentavos: remaining,
      },
      now,
      true,
    );
  }

  private async registerPayment(
    actor: AuthUser,
    id: string,
    dto: RecordPaymentDto,
    now: Date,
    simulated: boolean,
  ) {
    const today = businessDate(now);
    try {
      return await this.db.$transaction(
        async (tx) => {
          const invoice = await tx.fatura.findFirst({
            where: {
              id,
              instituicaoId: actor.instituicaoId,
              ...(simulated ? { matricula: { alunoId: actor.id } } : {}),
            },
          });
          if (!invoice) throw new NotFoundException('Fatura não encontrada');
          if (invoice.pagoCentavos + dto.valorCentavos > invoice.valorCentavos)
            throw new BadRequestException('Pagamento acima do saldo da fatura');
          const payment = await tx.pagamentoFatura.create({
            data: {
              instituicaoId: actor.instituicaoId,
              faturaId: id,
              referencia: dto.referencia,
              valorCentavos: dto.valorCentavos,
              recebidoEm: now,
              simulado: simulated,
            },
          });
          const paid = invoice.pagoCentavos + dto.valorCentavos;
          await tx.fatura.update({
            where: {
              instituicaoId_id: { instituicaoId: actor.instituicaoId, id },
            },
            data: {
              pagoCentavos: paid,
              situacao: invoiceState(
                invoice.vencimento,
                paid,
                invoice.valorCentavos,
                today,
              ),
            },
          });
          await this.updateFinancialFeatures(
            tx,
            actor.instituicaoId,
            invoice.matriculaId,
            today,
            actor.id,
          );
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: simulated ? 'SIMULAR_PAGAMENTO' : 'REGISTRAR_PAGAMENTO',
              recurso: 'FATURA',
              recursoId: id,
            },
          });
          return payment;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Referência de pagamento já utilizada');
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'Dados alterados simultaneamente; tente novamente',
        );
      throw error;
    }
  }

  async getMonthlyPlan(actor: AuthUser, matriculaId: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    const enrollment = await this.db.matricula.findFirst({
      where: { id: matriculaId, instituicaoId: actor.instituicaoId },
      select: {
        planoMensalidade: {
          select: {
            inicioCompetencia: true,
            fimCompetencia: true,
            proximaCompetencia: true,
            valorCentavos: true,
            diaVencimento: true,
            ativo: true,
          },
        },
      },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    return enrollment.planoMensalidade;
  }

  async searchEnrollments(actor: AuthUser, registro: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    const term = registro.trim();
    if (term.length < 2)
      throw new BadRequestException(
        'Informe ao menos 2 caracteres do registro',
      );
    return this.db.matricula.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        registro: { startsWith: term, mode: 'insensitive' },
      },
      select: {
        id: true,
        registro: true,
        aluno: { select: { nome: true } },
        turma: { select: { id: true, curso: true, duracaoSemestres: true } },
      },
      orderBy: { registro: 'asc' },
      take: 20,
    });
  }

  async list(actor: AuthUser, matriculaId: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA', 'ALUNO']);
    const enrollment = await this.db.matricula.findFirst({
      where: {
        id: matriculaId,
        instituicaoId: actor.instituicaoId,
        ...(actor.perfil === 'ALUNO' ? { alunoId: actor.id } : {}),
      },
      select: { id: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    return this.db.fatura.findMany({
      where: { instituicaoId: actor.instituicaoId, matriculaId },
      select: {
        id: true,
        competencia: true,
        semestre: true,
        vencimento: true,
        valorCentavos: true,
        pagoCentavos: true,
        situacao: true,
      },
      orderBy: { competencia: 'desc' },
    });
  }

  async semesters(actor: AuthUser, matriculaId: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA', 'ALUNO']);
    const enrollment = await this.db.matricula.findFirst({
      where: {
        id: matriculaId,
        instituicaoId: actor.instituicaoId,
        ...(actor.perfil === 'ALUNO' ? { alunoId: actor.id } : {}),
      },
      select: { turma: { select: { curso: true, duracaoSemestres: true } } },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    const invoices = await this.db.fatura.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        matriculaId,
        semestre: { not: null },
      },
      select: {
        semestre: true,
        valorCentavos: true,
        pagoCentavos: true,
        situacao: true,
      },
    });
    return Array.from(
      { length: enrollment.turma.duracaoSemestres },
      (_, index) => {
        const semestre = index + 1;
        const period = invoices.filter(
          (invoice) => invoice.semestre === semestre,
        );
        const devidoCentavos = period.reduce(
          (total, invoice) => total + invoice.valorCentavos,
          0,
        );
        const pagoCentavos = period.reduce(
          (total, invoice) => total + invoice.pagoCentavos,
          0,
        );
        return {
          curso: enrollment.turma.curso,
          semestre,
          mensalidades: period.length,
          devidoCentavos,
          pagoCentavos,
          saldoCentavos: devidoCentavos - pagoCentavos,
          situacao: period.some((invoice) => invoice.situacao === 'VENCIDA')
            ? 'ATRASADO'
            : period.length === 0
              ? 'NAO_INICIADO'
              : period.every((invoice) => invoice.situacao === 'QUITADA')
                ? 'QUITADO'
                : 'EM_DIA',
        };
      },
    );
  }

  async processOverdue(now = new Date()) {
    const today = businessDate(now);
    const due = await this.db.fatura.findMany({
      where: { situacao: SituacaoFatura.ABERTA, vencimento: { lt: today } },
      select: { id: true, instituicaoId: true, matriculaId: true },
      orderBy: { vencimento: 'asc' },
      take: 100,
    });
    let updated = 0;
    for (const invoice of due) {
      await this.db.$transaction(
        async (tx) => {
          const result = await tx.fatura.updateMany({
            where: {
              id: invoice.id,
              instituicaoId: invoice.instituicaoId,
              situacao: 'ABERTA',
            },
            data: { situacao: 'VENCIDA' },
          });
          if (!result.count) return;
          await this.updateFinancialFeatures(
            tx,
            invoice.instituicaoId,
            invoice.matriculaId,
            today,
          );
          await tx.auditoria.create({
            data: {
              instituicaoId: invoice.instituicaoId,
              acao: 'VENCER_FATURA',
              recurso: 'FATURA',
              recursoId: invoice.id,
            },
          });
          updated += 1;
        },
        { isolationLevel: 'Serializable' },
      );
    }
    return updated;
  }
}
