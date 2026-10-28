import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { MlClientService } from './ml-client.service';
import { ML_FEATURES, type MlFeatures } from './ml.types';
import { MlProfileDto } from './dto/ml-profile.dto';
import { SelfReportDto, TurnoDeclarado } from './dto/self-report.dto';
import { enrollmentScope, requireRole } from '../academic/academic.policy';
import { FATEC_CODES } from '../fatecs';

@Injectable()
export class EnrollmentMlService {
  constructor(
    private readonly db: PrismaService,
    private readonly ml: MlClientService,
  ) {}

  private async ownEnrollment(actor: AuthUser, id: string) {
    requireRole(actor, ['ALUNO']);
    const enrollment = await this.db.matricula.findFirst({
      where: { id, instituicaoId: actor.instituicaoId, alunoId: actor.id },
      select: { id: true, perfilMl: { select: { features: true } } },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    return enrollment;
  }

  async getSelfReport(actor: AuthUser, id: string) {
    const enrollment = await this.ownEnrollment(actor, id);
    const values = (enrollment.perfilMl?.features ?? {}) as Record<
      string,
      number
    >;
    return {
      matriculaId: id,
      idadeNoIngresso: Number.isInteger(values.idade_matricula)
        ? values.idade_matricula
        : null,
      turno:
        values.periodo_aula === 1
          ? TurnoDeclarado.DIURNO
          : values.periodo_aula === 0
            ? TurnoDeclarado.NOTURNO
            : null,
      informacao:
        'As respostas não geram uma previsão até que o modelo seja validado para as Fatecs.',
    };
  }

  async saveSelfReport(actor: AuthUser, id: string, dto: SelfReportDto) {
    requireRole(actor, ['ALUNO']);
    try {
      await this.db.$transaction(
        async (tx) => {
          const enrollment = await tx.matricula.findFirst({
            where: {
              id,
              instituicaoId: actor.instituicaoId,
              alunoId: actor.id,
            },
            select: { perfilMl: { select: { features: true } } },
          });
          if (!enrollment)
            throw new NotFoundException('Matrícula não encontrada');
          const existing = (enrollment.perfilMl?.features ?? {}) as Record<
            string,
            number
          >;
          const features = {
            ...existing,
            idade_matricula: dto.idadeNoIngresso,
            periodo_aula: dto.turno === TurnoDeclarado.DIURNO ? 1 : 0,
          };
          await tx.perfilMl.upsert({
            where: { matriculaId: id },
            create: {
              matriculaId: id,
              instituicaoId: actor.instituicaoId,
              features,
              fonte: 'Autodeclaração fatec-v1',
            },
            update: {
              features,
              fonte: 'Autodeclaração fatec-v1',
              versao: { increment: 1 },
              resultado: Prisma.DbNull,
            },
          });
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'AUTODECLARACAO_ML',
              recurso: 'MATRICULA',
              recursoId: id,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Dados alterados por outra sessão. Tente novamente.',
        );
      }
      throw error;
    }
    return this.getSelfReport(actor, id);
  }

  private async enrollment(actor: AuthUser, id: string) {
    requireRole(actor, ['ADMIN', 'COORDENACAO', 'PROFESSOR', 'TUTOR']);
    const item = await this.db.matricula.findFirst({
      where: {
        ...(actor.perfil === 'ADMIN'
          ? {
              turma: {
                instituicao: {
                  ativa: true,
                  codigoCps: { in: [...FATEC_CODES] },
                },
              },
            }
          : enrollmentScope(actor)),
        id,
      },
      include: { perfilMl: true, aluno: { select: { nome: true } } },
    });
    if (!item) throw new NotFoundException('Matrícula não encontrada');
    return item;
  }

  private async profile(actor: AuthUser, id: string) {
    const item = await this.enrollment(actor, id);
    const features = (item.perfilMl?.features ?? {}) as Record<string, number>;
    const faltantes = ML_FEATURES.filter(
      (name) => !Number.isFinite(features[name]),
    );
    return {
      matriculaId: id,
      instituicaoId: item.instituicaoId,
      registro: item.registro,
      aluno: item.aluno.nome,
      fonte: item.perfilMl?.fonte ?? 'Cadastro pendente',
      features,
      faltantes,
      versao: item.perfilMl?.versao ?? 0,
      resultado: item.perfilMl?.resultado ?? null,
    };
  }

  async get(actor: AuthUser, id: string) {
    return this.visible(actor, await this.profile(actor, id));
  }

  private visible(
    actor: AuthUser,
    profile: Awaited<ReturnType<EnrollmentMlService['profile']>>,
  ) {
    const editable = ['ADMIN', 'COORDENACAO'].includes(actor.perfil);
    const result = this.ml.fatecEligibility().valid
      ? (profile.resultado as Record<string, Prisma.JsonValue> | null)
      : null;
    return {
      matriculaId: profile.matriculaId,
      registro: profile.registro,
      aluno: profile.aluno,
      fonte: profile.fonte,
      faltantes: profile.faltantes,
      versao: profile.versao,
      features: editable ? profile.features : undefined,
      resultado: result
        ? {
            modelVersion: result.modelVersion,
            predictedClass: result.predictedClass,
            probabilities: result.probabilities,
            calculadoEm: result.calculadoEm,
            perfilVersao: result.perfilVersao,
          }
        : null,
    };
  }

  async save(actor: AuthUser, id: string, dto: MlProfileDto) {
    requireRole(actor, ['ADMIN', 'COORDENACAO']);
    const enrollment = await this.enrollment(actor, id);
    try {
      await this.db.$transaction(async (tx) => {
        if (dto.versao === 0) {
          await tx.perfilMl.create({
            data: {
              matriculaId: id,
              instituicaoId: enrollment.instituicaoId,
              features: dto.features,
            },
          });
        } else {
          const saved = await tx.perfilMl.updateMany({
            where: {
              matriculaId: id,
              instituicaoId: enrollment.instituicaoId,
              versao: dto.versao,
            },
            data: {
              features: dto.features,
              versao: { increment: 1 },
              resultado: Prisma.DbNull,
            },
          });
          if (saved.count !== 1)
            throw new ConflictException(
              'Dados atualizados por outra sessão. Recarregue antes de salvar.',
            );
        }
        await tx.auditoria.create({
          data: {
            instituicaoId: enrollment.instituicaoId,
            autorId: actor.id,
            acao: 'SALVAR_PERFIL_ML',
            recurso: 'MATRICULA',
            recursoId: id,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Perfil já criado. Recarregue.');
      throw error;
    }
    return this.get(actor, id);
  }

  async analyze(actor: AuthUser, id: string) {
    const profile = await this.profile(actor, id);
    const eligibility = this.ml.fatecEligibility();
    if (profile.faltantes.length || !eligibility.valid)
      return {
        status: 'INSUFICIENTE' as const,
        ...this.visible(actor, profile),
        impedimentos: eligibility.valid ? [] : [eligibility.reason],
      };
    const prediction = await this.ml.predict(
      profile.features as MlFeatures,
      'original',
    );
    const result = {
      ...prediction,
      calculadoEm: new Date().toISOString(),
      perfilVersao: profile.versao,
      features: profile.features,
    };
    await this.db.$transaction(async (tx) => {
      const updated = await tx.perfilMl.updateMany({
        where: {
          matriculaId: id,
          instituicaoId: profile.instituicaoId,
          versao: profile.versao,
        },
        data: { resultado: result },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Dados alterados durante a análise. Execute novamente.',
        );
      await tx.auditoria.create({
        data: {
          instituicaoId: profile.instituicaoId,
          autorId: actor.id,
          acao: 'CALCULAR_PREVISAO_ML',
          recurso: 'MATRICULA',
          recursoId: id,
        },
      });
    });
    return {
      status: 'CALCULADO' as const,
      impedimentos: [],
      ...this.visible(actor, { ...profile, resultado: result }),
    };
  }
}
