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
import { applySourceFeatures } from '../feature-source-sync';
import {
  MacroCohortDto,
  MacroSourceDto,
  SemesterSourceDto,
} from './official-sources.dto';

const macroKeys = {
  desemprego: undefined,
  inflacao: undefined,
  pib: undefined,
};

@Injectable()
export class OfficialSourcesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfficialSourcesService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly db: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.runSweep(), 60_000);
    this.timer.unref();
    this.runSweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private runSweep() {
    void this.processPending().catch((error: unknown) =>
      this.logger.error(
        'Falha ao reconciliar indicadores macroeconômicos',
        error,
      ),
    );
  }

  private async enrollment(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    id: string,
  ) {
    const item = await tx.matricula.findFirst({
      where: { id, instituicaoId: actor.instituicaoId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Matrícula não encontrada');
  }

  async semester(actor: AuthUser, id: string, semester: number) {
    requireRole(actor, ['ADMIN', 'SECRETARIA']);
    if (semester !== 1 && semester !== 2)
      throw new BadRequestException('Semestre deve ser 1 ou 2');
    const item = await this.db.matricula.findFirst({
      where: { id, instituicaoId: actor.instituicaoId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Matrícula não encontrada');
    return this.db.resumoSemestreMl.findUnique({
      where: {
        instituicaoId_matriculaId_semestre: {
          instituicaoId: actor.instituicaoId,
          matriculaId: id,
          semestre: semester,
        },
      },
    });
  }

  async saveSemester(
    actor: AuthUser,
    id: string,
    semester: number,
    dto: SemesterSourceDto,
  ) {
    requireRole(actor, ['ADMIN', 'SECRETARIA']);
    if (semester !== 1 && semester !== 2)
      throw new BadRequestException('Semestre deve ser 1 ou 2');
    if (dto.semAvaliacao > dto.matriculadas)
      throw new BadRequestException(
        'Unidades sem avaliação excedem as matriculadas',
      );
    const prefix = `ucs_${semester}sem_`;
    const patch = {
      [`${prefix}creditadas`]: dto.creditadas,
      [`${prefix}matriculadas`]: dto.matriculadas,
      [`${prefix}avaliacoes`]: dto.avaliacoes,
      [`${prefix}aprovadas`]: dto.aprovadas,
      [`${prefix}nota`]: dto.nota,
      [`${prefix}sem_aval`]: dto.semAvaliacao,
    };
    try {
      return await this.db.$transaction(
        async (tx) => {
          await this.enrollment(tx, actor, id);
          const key = {
            instituicaoId: actor.instituicaoId,
            matriculaId: id,
            semestre: semester,
          };
          const values = {
            creditadas: dto.creditadas,
            matriculadas: dto.matriculadas,
            avaliacoes: dto.avaliacoes,
            aprovadas: dto.aprovadas,
            nota: dto.nota,
            semAvaliacao: dto.semAvaliacao,
            fonteRef: dto.fonteRef.trim(),
          };
          if (dto.versao === 0) {
            await tx.resumoSemestreMl.create({ data: { ...key, ...values } });
          } else {
            const updated = await tx.resumoSemestreMl.updateMany({
              where: { ...key, revisao: dto.versao },
              data: { ...values, revisao: { increment: 1 } },
            });
            if (updated.count !== 1)
              throw new ConflictException(
                'Resumo alterado. Recarregue antes de salvar.',
              );
          }
          await applySourceFeatures(tx, {
            instituicaoId: actor.instituicaoId,
            matriculaId: id,
            patch,
            origem: 'ACADEMICO_OFICIAL',
            autorId: actor.id,
          });
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'HOMOLOGAR_RESUMO_SEMESTRE',
              recurso: 'MATRICULA',
              recursoId: id,
            },
          });
          return { semestre: semester, versao: dto.versao + 1, ...values };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Resumo já existe. Recarregue.');
        if (error.code === 'P2034')
          throw new ConflictException('Resumo alterado por outra sessão');
      }
      throw error;
    }
  }

  async cohort(actor: AuthUser, id: string) {
    requireRole(actor, ['ADMIN', 'SECRETARIA']);
    const item = await this.db.matricula.findFirst({
      where: { id, instituicaoId: actor.instituicaoId },
      select: { macroPais: true, macroAno: true, macroPendente: true },
    });
    if (!item) throw new NotFoundException('Matrícula não encontrada');
    return item;
  }

  async setCohort(actor: AuthUser, id: string, dto: MacroCohortDto) {
    requireRole(actor, ['ADMIN', 'SECRETARIA']);
    await this.db.$transaction(
      async (tx) => {
        await this.enrollment(tx, actor, id);
        await tx.matricula.update({
          where: {
            instituicaoId_id: { instituicaoId: actor.instituicaoId, id },
          },
          data: { macroPais: dto.pais, macroAno: dto.ano, macroPendente: true },
        });
        await this.applyMacro(
          tx,
          actor.instituicaoId,
          id,
          dto.pais,
          dto.ano,
          actor.id,
        );
        await tx.matricula.update({
          where: {
            instituicaoId_id: { instituicaoId: actor.instituicaoId, id },
          },
          data: { macroPendente: false },
        });
        await tx.auditoria.create({
          data: {
            instituicaoId: actor.instituicaoId,
            autorId: actor.id,
            acao: 'VINCULAR_COORTE_MACRO',
            recurso: 'MATRICULA',
            recursoId: id,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.cohort(actor, id);
  }

  private async applyMacro(
    tx: Prisma.TransactionClient,
    instituicaoId: string,
    matriculaId: string,
    pais: string | null,
    ano: number | null,
    autorId?: string,
  ) {
    const source =
      pais && ano
        ? await tx.indicadorMacro.findUnique({
            where: { instituicaoId_pais_ano: { instituicaoId, pais, ano } },
          })
        : null;
    await applySourceFeatures(tx, {
      instituicaoId,
      matriculaId,
      patch: source
        ? {
            desemprego: source.desemprego,
            inflacao: source.inflacao,
            pib: source.pib,
          }
        : macroKeys,
      origem: 'MACRO_OFICIAL',
      autorId,
    });
  }

  async macro(actor: AuthUser, pais: string, ano: number) {
    requireRole(actor, ['ADMIN', 'SECRETARIA']);
    return this.db.indicadorMacro.findUnique({
      where: {
        instituicaoId_pais_ano: {
          instituicaoId: actor.instituicaoId,
          pais,
          ano,
        },
      },
    });
  }

  async saveMacro(
    actor: AuthUser,
    pais: string,
    ano: number,
    dto: MacroSourceDto,
  ) {
    requireRole(actor, ['ADMIN']);
    const saved = await this.db.$transaction(
      async (tx) => {
        const key = { instituicaoId: actor.instituicaoId, pais, ano };
        const source = await tx.indicadorMacro.upsert({
          where: { instituicaoId_pais_ano: key },
          create: { ...key, ...dto },
          update: { ...dto, versao: { increment: 1 } },
        });
        await tx.matricula.updateMany({
          where: {
            instituicaoId: actor.instituicaoId,
            macroPais: pais,
            macroAno: ano,
          },
          data: { macroPendente: true },
        });
        await tx.auditoria.create({
          data: {
            instituicaoId: actor.instituicaoId,
            autorId: actor.id,
            acao: 'PUBLICAR_INDICADOR_MACRO',
            recurso: 'INDICADOR_MACRO',
          },
        });
        return source;
      },
      { isolationLevel: 'Serializable' },
    );
    await this.processPending();
    return saved;
  }

  async processPending() {
    const pending = await this.db.matricula.findMany({
      where: { macroPendente: true },
      select: { id: true },
      take: 100,
    });
    let done = 0;
    for (const item of pending) {
      await this.db.$transaction(
        async (tx) => {
          const enrollment = await tx.matricula.findUnique({
            where: { id: item.id },
            select: {
              instituicaoId: true,
              macroPais: true,
              macroAno: true,
              macroPendente: true,
            },
          });
          if (!enrollment?.macroPendente) return;
          await this.applyMacro(
            tx,
            enrollment.instituicaoId,
            item.id,
            enrollment.macroPais,
            enrollment.macroAno,
          );
          await tx.matricula.update({
            where: { id: item.id },
            data: { macroPendente: false },
          });
          done += 1;
        },
        { isolationLevel: 'Serializable' },
      );
    }
    return done;
  }
}
