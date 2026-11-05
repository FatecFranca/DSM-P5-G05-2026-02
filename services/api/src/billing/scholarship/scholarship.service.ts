import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { requireRole } from '../../academic/academic.policy';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { recordAttributeChanges } from '../../ml/attribute-events';
import { businessDate } from '../billing.service';
import { ScholarshipDto } from './scholarship.dto';

function civilDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new BadRequestException('Data de vigência inválida');
  return date;
}

function inEffect(
  plan: { inicio: Date; fim: Date | null; ativa: boolean },
  today: Date,
) {
  return plan.ativa && plan.inicio <= today && (!plan.fim || plan.fim >= today);
}

@Injectable()
export class ScholarshipService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScholarshipService.name);
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
    void this.processTransitions().catch((error: unknown) => {
      this.logger.error('Falha ao atualizar vigências de bolsas', error);
    });
  }

  private async apply(
    tx: Prisma.TransactionClient,
    plan: {
      matriculaId: string;
      instituicaoId: string;
      inicio: Date;
      fim: Date | null;
      ativa: boolean;
      estadoAplicado: boolean;
    },
    today: Date,
    autorId?: string,
  ) {
    const value = inEffect(plan, today) ? 1 : 0;
    const profile = await tx.perfilMl.findUnique({
      where: { matriculaId: plan.matriculaId },
      select: { features: true, versao: true },
    });
    const before = (profile?.features ?? {}) as Record<string, number>;
    if (before.bolsista !== value) {
      const after = { ...before, bolsista: value };
      if (profile) {
        const updated = await tx.perfilMl.updateMany({
          where: {
            matriculaId: plan.matriculaId,
            instituicaoId: plan.instituicaoId,
            versao: profile.versao,
          },
          data: {
            features: after,
            versao: { increment: 1 },
            resultado: Prisma.DbNull,
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Perfil alterado durante a atualização');
      } else {
        await tx.perfilMl.create({
          data: {
            instituicaoId: plan.instituicaoId,
            matriculaId: plan.matriculaId,
            features: after,
            fonte: 'Bolsa institucional',
          },
        });
      }
      await recordAttributeChanges(tx, {
        instituicaoId: plan.instituicaoId,
        matriculaId: plan.matriculaId,
        before,
        after,
        versaoPerfil: (profile?.versao ?? 0) + 1,
        origem: 'BOLSA',
        autorId,
      });
    }
    if (plan.estadoAplicado !== Boolean(value))
      await tx.bolsaMatricula.update({
        where: { matriculaId: plan.matriculaId },
        data: { estadoAplicado: Boolean(value) },
      });
  }

  async set(actor: AuthUser, matriculaId: string, dto: ScholarshipDto) {
    requireRole(actor, ['ADMIN', 'FINANCEIRO']);
    const inicio = civilDate(dto.inicio);
    const fim = dto.fim ? civilDate(dto.fim) : null;
    if (fim && fim < inicio)
      throw new BadRequestException('Fim da bolsa anterior ao início');
    try {
      return await this.db.$transaction(
        async (tx) => {
          const enrollment = await tx.matricula.findFirst({
            where: { id: matriculaId, instituicaoId: actor.instituicaoId },
            select: { id: true },
          });
          if (!enrollment)
            throw new NotFoundException('Matrícula não encontrada');
          const plan = await tx.bolsaMatricula.upsert({
            where: { matriculaId },
            create: {
              instituicaoId: actor.instituicaoId,
              matriculaId,
              inicio,
              fim,
              ativa: dto.ativa,
            },
            update: { inicio, fim, ativa: dto.ativa },
          });
          await this.apply(tx, plan, businessDate(new Date()), actor.id);
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'CONFIGURAR_BOLSA',
              recurso: 'MATRICULA',
              recursoId: matriculaId,
            },
          });
          return { inicio: plan.inicio, fim: plan.fim, ativa: plan.ativa };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException('Bolsa alterada por outra sessão');
      throw error;
    }
  }

  async get(actor: AuthUser, matriculaId: string) {
    requireRole(actor, ['ADMIN', 'FINANCEIRO', 'ALUNO']);
    const enrollment = await this.db.matricula.findFirst({
      where: {
        id: matriculaId,
        instituicaoId: actor.instituicaoId,
        ...(actor.perfil === 'ALUNO' ? { alunoId: actor.id } : {}),
      },
      select: { bolsa: { select: { inicio: true, fim: true, ativa: true } } },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    return enrollment.bolsa
      ? {
          ...enrollment.bolsa,
          vigente: inEffect(enrollment.bolsa, businessDate(new Date())),
        }
      : null;
  }

  async processTransitions(now = new Date()) {
    const today = businessDate(now);
    const due = await this.db.bolsaMatricula.findMany({
      where: {
        OR: [
          {
            estadoAplicado: false,
            ativa: true,
            inicio: { lte: today },
            OR: [{ fim: null }, { fim: { gte: today } }],
          },
          {
            estadoAplicado: true,
            OR: [
              { ativa: false },
              { inicio: { gt: today } },
              { fim: { lt: today } },
            ],
          },
        ],
      },
      select: { matriculaId: true },
      take: 100,
    });
    let updated = 0;
    for (const item of due) {
      await this.db.$transaction(
        async (tx) => {
          const plan = await tx.bolsaMatricula.findUnique({
            where: { matriculaId: item.matriculaId },
          });
          if (!plan || plan.estadoAplicado === inEffect(plan, today)) return;
          await this.apply(tx, plan, today);
          updated += 1;
        },
        { isolationLevel: 'Serializable' },
      );
    }
    return updated;
  }
}
