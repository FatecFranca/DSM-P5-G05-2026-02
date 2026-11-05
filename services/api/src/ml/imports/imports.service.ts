import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth-user';
import { MlClientService } from '../ml-client.service';
import { EnrollmentMlService } from '../enrollment-ml.service';
import { type MlFeatures } from '../ml.types';
import { ML_FEATURES } from '../ml.types';
import { parseImportWorkbook } from './workbook-parser';
import { requireRole } from '../../academic/academic.policy';
import { ACTIVE_MODEL_VERSION } from '../model-version';

@Injectable()
export class ImportsService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly ml: MlClientService,
    private readonly profiles: EnrollmentMlService,
  ) {}

  async import(actor: AuthUser, buffer: Buffer) {
    requireRole(actor, ['ADMIN']);
    const rows = await parseImportWorkbook(buffer);
    if (this.config.get<string>('ML_PREVIEW_ENABLED') !== 'true') {
      throw new ServiceUnavailableException(
        'Prévia técnica de ML desabilitada',
      );
    }
    const status = await this.ml.status();
    if (
      !status.ready ||
      !status.originalInputReady ||
      status.modelVersion !== ACTIVE_MODEL_VERSION
    ) {
      throw new ServiceUnavailableException(
        'O modelo .pkl ativo não está pronto para importação',
      );
    }
    const modelVersion = status.modelVersion;
    const arquivoSha256 = createHash('sha256').update(buffer).digest('hex');
    const enrolled = await this.db.matricula.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        registro: { in: rows.map((row) => row.registro) },
      },
      select: {
        id: true,
        registro: true,
        perfilMl: { select: { versao: true, features: true } },
      },
    });
    const byRegistro = new Map(enrolled.map((item) => [item.registro, item]));
    if (enrolled.length !== rows.length) {
      const missing = rows
        .filter((row) => !byRegistro.has(row.registro))
        .map((row) => row.registro);
      throw new BadRequestException(
        `Matrículas não encontradas na instituição: ${missing.join(', ')}`,
      );
    }
    const previous = await this.db.previsaoImportadaMl.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        arquivoSha256,
        modelVersion,
        matriculaId: { in: enrolled.map((item) => item.id) },
      },
    });
    const byMatricula = new Map(
      previous.map((item) => [item.matriculaId, item]),
    );
    const pending = rows.filter((row) => {
      const student = byRegistro.get(row.registro)!;
      const prior = byMatricula.get(student.id);
      return !(
        prior &&
        prior.perfilVersao === student.perfilMl?.versao &&
        ML_FEATURES.every(
          (name) =>
            (prior.features as Record<string, number>)[name] ===
            row.features[name],
        )
      );
    });
    for (const row of pending) {
      const current = byRegistro.get(row.registro)!.perfilMl?.versao ?? 0;
      const savedFeatures = byRegistro.get(row.registro)!.perfilMl?.features as
        Record<string, number> | undefined;
      const canRecover =
        current === row.versaoPerfil + 1 &&
        savedFeatures &&
        ML_FEATURES.every((name) => savedFeatures[name] === row.features[name]);
      if (row.versaoPerfil !== current && !canRecover) {
        throw new ConflictException(
          `Linha ${row.linha}: perfil alterado. Informe versaoPerfil=${current}`,
        );
      }
    }
    if (!pending.length)
      return {
        modelVersion,
        arquivoSha256,
        total: rows.length,
        salvos: 0,
        repetidos: rows.length,
        erros: [],
        status: 'EXPERIMENTAL' as const,
      };
    const items = pending.map((row) => ({
      ref: randomUUID(),
      features: row.features,
    }));
    const prediction = await this.ml.predictBatch({
      model_version: modelVersion,
      input_format: 'original',
      request_id: randomUUID(),
      items,
    });
    const byRef = new Map(prediction.results.map((item) => [item.ref, item]));
    const erros: Array<{ linha: number; registro: string; motivo: string }> =
      [];
    let salvos = 0;
    for (let index = 0; index < pending.length; index++) {
      const row = pending[index];
      const student = byRegistro.get(row.registro)!;
      const result = byRef.get(items[index].ref)!;
      try {
        const currentProfile = student.perfilMl;
        const canRecover =
          currentProfile?.versao === row.versaoPerfil + 1 &&
          ML_FEATURES.every(
            (name) =>
              (currentProfile.features as Record<string, number>)[name] ===
              row.features[name],
          );
        const saved = canRecover
          ? await this.profiles.get(actor, student.id)
          : await this.profiles.save(actor, student.id, {
              versao: row.versaoPerfil,
              features: row.features,
            });
        if (
          saved.versao !== row.versaoPerfil + 1 ||
          saved.faltantes.length ||
          !saved.features ||
          ML_FEATURES.some(
            (name) => saved.features?.[name] !== row.features[name],
          )
        ) {
          throw new ConflictException('Perfil alterado durante a importação');
        }
        await this.db.$transaction(async (tx) => {
          await tx.previsaoImportadaMl.upsert({
            where: {
              instituicaoId_matriculaId_arquivoSha256_modelVersion: {
                instituicaoId: actor.instituicaoId,
                matriculaId: student.id,
                arquivoSha256,
                modelVersion,
              },
            },
            create: {
              instituicaoId: actor.instituicaoId,
              matriculaId: student.id,
              arquivoSha256,
              linha: row.linha,
              modelVersion,
              perfilVersao: saved.versao,
              features: saved.features as MlFeatures,
              predictedClass: result.predicted_class,
              probabilities: result.probabilities,
              autorId: actor.id,
            },
            update: {
              linha: row.linha,
              perfilVersao: saved.versao,
              features: saved.features as MlFeatures,
              predictedClass: result.predicted_class,
              probabilities: result.probabilities,
              autorId: actor.id,
              calculadoEm: new Date(),
            },
          });
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'IMPORTAR_PREVISAO_ML_EXPERIMENTAL',
              recurso: 'MATRICULA',
              recursoId: student.id,
            },
          });
        });
        salvos++;
      } catch (error) {
        erros.push({
          linha: row.linha,
          registro: row.registro,
          motivo:
            error instanceof Error ? error.message : 'Erro ao salvar a linha',
        });
      }
    }
    return {
      modelVersion,
      arquivoSha256,
      total: rows.length,
      salvos,
      repetidos: rows.length - pending.length,
      erros,
      status: 'EXPERIMENTAL',
    };
  }

  async recent(actor: AuthUser) {
    requireRole(actor, ['ADMIN']);
    const items = await this.db.previsaoImportadaMl.findMany({
      where: { instituicaoId: actor.instituicaoId },
      take: 50,
      orderBy: [{ calculadoEm: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        arquivoSha256: true,
        linha: true,
        modelVersion: true,
        perfilVersao: true,
        predictedClass: true,
        probabilities: true,
        calculadoEm: true,
        matricula: {
          select: { registro: true, perfilMl: { select: { versao: true } } },
        },
      },
    });
    return items.map(({ matricula, ...item }) => ({
      ...item,
      registro: matricula.registro,
      atual: matricula.perfilMl?.versao === item.perfilVersao,
      status: 'EXPERIMENTAL' as const,
    }));
  }
}
