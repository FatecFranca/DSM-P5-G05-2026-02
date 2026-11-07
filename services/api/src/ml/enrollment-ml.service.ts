import {
  BadRequestException,
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
import {
  FATEC_DEMO_ML_SOURCE,
  FATEC_DEMO_REGISTRATIONS,
} from './fatec-demo-profile';
import { validProfile } from './profile-validation';
import { businessDate } from '../billing/billing.service';
import { recordAttributeChanges } from './attribute-events';
import type { AttributeHistoryDto } from './dto/attribute-history.dto';
import { INGRESS_FEATURES } from './dto/ingress-source.dto';

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
        'As respostas não geram uma previsão até que o modelo seja validado para os alunos desta instituição.',
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
            select: { perfilMl: { select: { features: true, versao: true } } },
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
              fonte: 'Autodeclaração uci-portugal-v1',
            },
            update: {
              features,
              fonte: 'Autodeclaração uci-portugal-v1',
              versao: { increment: 1 },
              resultado: Prisma.DbNull,
            },
          });
          await recordAttributeChanges(tx, {
            instituicaoId: actor.instituicaoId,
            matriculaId: id,
            before: existing,
            after: features,
            versaoPerfil: (enrollment.perfilMl?.versao ?? 0) + 1,
            origem: 'AUTODECLARACAO',
            autorId: actor.id,
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
    requireRole(actor, ['COORDENACAO', 'PROFESSOR', 'TUTOR']);
    const item = await this.db.matricula.findFirst({
      where: {
        ...enrollmentScope(actor),
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

  async attributeHistory(
    actor: AuthUser,
    id: string,
    query: AttributeHistoryDto,
  ) {
    requireRole(actor, ['COORDENACAO']);
    await this.enrollment(actor, id);
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const where = { instituicaoId: actor.instituicaoId, matriculaId: id };
    const [itens, total] = await this.db.$transaction([
      this.db.atributoMlEvento.findMany({
        where,
        select: {
          atributo: true,
          valorAnterior: true,
          valorAtual: true,
          origem: true,
          autorId: true,
          versaoPerfil: true,
          registradoEm: true,
        },
        orderBy: [
          { versaoPerfil: 'desc' },
          { registradoEm: 'desc' },
          { id: 'desc' },
        ],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.db.atributoMlEvento.count({ where }),
    ]);
    return { itens, total, pagina, tamanho };
  }

  async demoPreview(actor: AuthUser, id: string) {
    const profile = await this.profile(actor, id);
    if (
      profile.aluno !== 'Aluno Demo SGEI' ||
      !FATEC_DEMO_REGISTRATIONS.includes(profile.registro) ||
      profile.fonte !== FATEC_DEMO_ML_SOURCE
    ) {
      throw new NotFoundException('Demonstração não encontrada');
    }
    if (profile.faltantes.length || !validProfile(profile.features)) {
      throw new ConflictException('Ficha demonstrativa incompleta');
    }
    const prediction = await this.ml.preview(
      profile.features as MlFeatures,
      'original',
    );
    return { ...prediction, demonstracao: true, fonte: profile.fonte };
  }

  private visible(
    actor: AuthUser,
    profile: Awaited<ReturnType<EnrollmentMlService['profile']>>,
  ) {
    const editable = ['COORDENACAO'].includes(actor.perfil);
    const savedResult = profile.resultado as Record<
      string,
      Prisma.JsonValue
    > | null;
    const result =
      savedResult?.perfilVersao === profile.versao ? savedResult : null;
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
            demonstracao: result.demonstracao === true,
          }
        : null,
    };
  }

  async save(actor: AuthUser, id: string, dto: MlProfileDto) {
    requireRole(actor, ['COORDENACAO']);
    const enrollment = await this.enrollment(actor, id);
    try {
      await this.db.$transaction(async (tx) => {
        const invoices = await tx.fatura.findMany({
          where: { instituicaoId: enrollment.instituicaoId, matriculaId: id },
          select: { vencimento: true, pagoCentavos: true, valorCentavos: true },
        });
        let features = { ...dto.features };
        let financialApplied = false;
        let scholarshipApplied = false;
        const academicNames = new Set<string>();
        let macroApplied = false;
        let ingressApplied = false;
        const today = businessDate(new Date());
        if (invoices.length) {
          const overdue = invoices.some(
            (invoice) =>
              invoice.vencimento < today &&
              invoice.pagoCentavos < invoice.valorCentavos,
          );
          const financial = {
            devedor: overdue ? 1 : 0,
            mensalidade_em_dia: overdue ? 0 : 1,
          };
          if (
            (dto.features.devedor !== undefined &&
              dto.features.devedor !== financial.devedor) ||
            (dto.features.mensalidade_em_dia !== undefined &&
              dto.features.mensalidade_em_dia !== financial.mensalidade_em_dia)
          )
            throw new BadRequestException(
              'Indicadores financeiros são calculados pelas faturas',
            );
          features = { ...dto.features, ...financial };
          financialApplied = true;
        }
        const scholarship = await tx.bolsaMatricula.findUnique({
          where: { matriculaId: id },
          select: { inicio: true, fim: true, ativa: true },
        });
        if (scholarship) {
          const bolsista = Number(
            scholarship.ativa &&
              scholarship.inicio <= today &&
              (!scholarship.fim || scholarship.fim >= today),
          );
          if (
            dto.features.bolsista !== undefined &&
            dto.features.bolsista !== bolsista
          )
            throw new BadRequestException(
              'Indicador de bolsa é calculado pela vigência institucional',
            );
          features = { ...features, bolsista };
          scholarshipApplied = true;
        }
        const semesters = await tx.resumoSemestreMl.findMany({
          where: { instituicaoId: enrollment.instituicaoId, matriculaId: id },
        });
        for (const semester of semesters) {
          const prefix = `ucs_${semester.semestre}sem_`;
          const official = {
            [`${prefix}creditadas`]: semester.creditadas,
            [`${prefix}matriculadas`]: semester.matriculadas,
            [`${prefix}avaliacoes`]: semester.avaliacoes,
            [`${prefix}aprovadas`]: semester.aprovadas,
            [`${prefix}nota`]: semester.nota,
            [`${prefix}sem_aval`]: semester.semAvaliacao,
          };
          for (const [name, value] of Object.entries(official)) {
            if (
              dto.features[name] !== undefined &&
              dto.features[name] !== value
            )
              throw new BadRequestException(
                'Indicadores semestrais são calculados a partir do resumo oficial',
              );
            academicNames.add(name);
          }
          features = { ...features, ...official };
        }
        const cohort = await tx.matricula.findFirst({
          where: { id, instituicaoId: enrollment.instituicaoId },
          select: { macroPais: true, macroAno: true },
        });
        if (cohort?.macroPais && cohort.macroAno) {
          const macro = await tx.indicadorMacro.findUnique({
            where: {
              instituicaoId_pais_ano: {
                instituicaoId: enrollment.instituicaoId,
                pais: cohort.macroPais,
                ano: cohort.macroAno,
              },
            },
          });
          if (macro) {
            const official = {
              desemprego: macro.desemprego,
              inflacao: macro.inflacao,
              pib: macro.pib,
            };
            for (const [name, value] of Object.entries(official))
              if (
                dto.features[name] !== undefined &&
                dto.features[name] !== value
              )
                throw new BadRequestException(
                  'Indicadores macroeconômicos vêm da fonte institucional',
                );
            features = { ...features, ...official };
            macroApplied = true;
          }
        }
        const ingress = await tx.fonteIngressoMl.findUnique({
          where: { matriculaId: id },
          select: { features: true },
        });
        if (ingress) {
          const official = ingress.features as Record<string, number>;
          for (const name of INGRESS_FEATURES) {
            if (
              dto.features[name] !== undefined &&
              dto.features[name] !== official[name]
            )
              throw new BadRequestException(
                'Dados de ingresso vêm da fonte homologada',
              );
            if (official[name] === undefined) delete features[name];
            else features[name] = official[name];
          }
          ingressApplied = true;
        }
        if (dto.versao === 0) {
          await tx.perfilMl.create({
            data: {
              matriculaId: id,
              instituicaoId: enrollment.instituicaoId,
              features,
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
              features,
              versao: { increment: 1 },
              resultado: Prisma.DbNull,
            },
          });
          if (saved.count !== 1)
            throw new ConflictException(
              'Dados atualizados por outra sessão. Recarregue antes de salvar.',
            );
        }
        const before = (enrollment.perfilMl?.features ?? {}) as Record<
          string,
          number
        >;
        await recordAttributeChanges(tx, {
          instituicaoId: enrollment.instituicaoId,
          matriculaId: id,
          before,
          after: features,
          versaoPerfil: dto.versao + 1,
          origem: 'CADASTRO_INSTITUCIONAL',
          autorId: actor.id,
          atributos: ML_FEATURES.filter(
            (name) =>
              !(
                financialApplied &&
                (name === 'devedor' || name === 'mensalidade_em_dia')
              ) &&
              !(scholarshipApplied && name === 'bolsista') &&
              !academicNames.has(name) &&
              !(
                ingressApplied &&
                INGRESS_FEATURES.includes(
                  name as (typeof INGRESS_FEATURES)[number],
                )
              ) &&
              !(
                macroApplied && ['desemprego', 'inflacao', 'pib'].includes(name)
              ),
          ),
        });
        if (financialApplied)
          await recordAttributeChanges(tx, {
            instituicaoId: enrollment.instituicaoId,
            matriculaId: id,
            before,
            after: features,
            versaoPerfil: dto.versao + 1,
            origem: 'FINANCEIRO',
            atributos: ['devedor', 'mensalidade_em_dia'],
          });
        if (scholarshipApplied)
          await recordAttributeChanges(tx, {
            instituicaoId: enrollment.instituicaoId,
            matriculaId: id,
            before,
            after: features,
            versaoPerfil: dto.versao + 1,
            origem: 'BOLSA',
            atributos: ['bolsista'],
          });
        if (academicNames.size)
          await recordAttributeChanges(tx, {
            instituicaoId: enrollment.instituicaoId,
            matriculaId: id,
            before,
            after: features,
            versaoPerfil: dto.versao + 1,
            origem: 'ACADEMICO_OFICIAL',
            atributos: [...academicNames] as (typeof ML_FEATURES)[number][],
          });
        if (macroApplied)
          await recordAttributeChanges(tx, {
            instituicaoId: enrollment.instituicaoId,
            matriculaId: id,
            before,
            after: features,
            versaoPerfil: dto.versao + 1,
            origem: 'MACRO_OFICIAL',
            atributos: ['desemprego', 'inflacao', 'pib'],
          });
        if (ingressApplied)
          await recordAttributeChanges(tx, {
            instituicaoId: enrollment.instituicaoId,
            matriculaId: id,
            before,
            after: features,
            versaoPerfil: dto.versao + 1,
            origem: 'INGRESSO_OFICIAL',
            atributos: INGRESS_FEATURES,
          });
        await tx.auditoria.create({
          data: {
            instituicaoId: actor.instituicaoId,
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
    if (profile.faltantes.length)
      return {
        status: 'INSUFICIENTE' as const,
        ...this.visible(actor, profile),
        impedimentos: [],
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
          instituicaoId: actor.instituicaoId,
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
