import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { requireRole } from '../academic/academic.policy';
import type { AuthUser } from '../auth/auth-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from './ml-client.service';
import { ML_FEATURES, type MlFeatures } from './ml.types';
import { ACTIVE_MODEL_VERSION } from './model-version';
import { validProfile } from './profile-validation';

const PAGE_SIZE = 100;

@Injectable()
export class AutomaticPredictionsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AutomaticPredictionsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly ml: MlClientService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('ML_PREVIEW_ENABLED') !== 'true') return;
    this.timer = setInterval(() => this.run(), 60_000);
    this.timer.unref();
    this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private run() {
    if (this.running) return;
    this.running = true;
    void this.processPending()
      .catch((error: unknown) => {
        this.logger.warn(
          'Recálculo experimental indisponível; nova tentativa agendada',
          error,
        );
      })
      .finally(() => {
        this.running = false;
      });
  }

  async processPending() {
    if (this.config.get<string>('ML_PREVIEW_ENABLED') !== 'true') return 0;
    const status = await this.ml.status();
    if (
      !status.ready ||
      !status.originalInputReady ||
      status.modelVersion !== ACTIVE_MODEL_VERSION
    )
      return 0;

    let cursor: string | undefined;
    let calculated = 0;
    while (calculated < PAGE_SIZE) {
      const profiles = await this.db.perfilMl.findMany({
        where: { matricula: { previsoesImportadas: { some: {} } } },
        select: {
          matriculaId: true,
          instituicaoId: true,
          versao: true,
          features: true,
          matricula: {
            select: {
              previsoesImportadas: {
                take: 1,
                orderBy: [{ calculadoEm: 'desc' }, { id: 'desc' }],
                select: { perfilVersao: true, modelVersion: true },
              },
            },
          },
        },
        orderBy: { matriculaId: 'asc' },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { matriculaId: cursor }, skip: 1 } : {}),
      });
      if (!profiles.length) break;
      cursor = profiles[profiles.length - 1].matriculaId;
      const eligible = profiles.filter((profile) => {
        const features: unknown = profile.features;
        const imported = profile.matricula.previsoesImportadas[0];
        return (
          validProfile(features) &&
          ML_FEATURES.every((name) => Number.isFinite(features[name])) &&
          !(
            imported?.perfilVersao === profile.versao &&
            imported.modelVersion === status.modelVersion
          )
        );
      });
      if (eligible.length) {
        const existing = await this.db.previsaoAutomaticaMl.findMany({
          where: {
            modelVersion: status.modelVersion,
            OR: eligible.map((profile) => ({
              instituicaoId: profile.instituicaoId,
              matriculaId: profile.matriculaId,
              perfilVersao: profile.versao,
            })),
          },
          select: { matriculaId: true, perfilVersao: true },
        });
        const completed = new Set(
          existing.map((item) => `${item.matriculaId}:${item.perfilVersao}`),
        );
        const pending = eligible
          .filter(
            (profile) =>
              !completed.has(`${profile.matriculaId}:${profile.versao}`),
          )
          .slice(0, PAGE_SIZE - calculated);
        if (pending.length) {
          const items = pending.map((profile) => ({
            ref: randomUUID(),
            features: profile.features as MlFeatures,
          }));
          const predictions = await this.ml.predictBatch({
            model_version: status.modelVersion,
            input_format: 'original',
            request_id: randomUUID(),
            items,
          });
          const byRef = new Map(
            predictions.results.map((item) => [item.ref, item]),
          );
          for (let index = 0; index < pending.length; index++) {
            const profile = pending[index];
            const prediction = byRef.get(items[index].ref);
            if (!prediction) continue;
            try {
              await this.db.$transaction(
                async (tx) => {
                  const latest = await tx.perfilMl.findUnique({
                    where: { matriculaId: profile.matriculaId },
                    select: { versao: true, instituicaoId: true },
                  });
                  if (
                    latest?.versao !== profile.versao ||
                    latest.instituicaoId !== profile.instituicaoId
                  )
                    return;
                  const saved = await tx.previsaoAutomaticaMl.createMany({
                    data: {
                      instituicaoId: profile.instituicaoId,
                      matriculaId: profile.matriculaId,
                      modelVersion: status.modelVersion!,
                      perfilVersao: profile.versao,
                      features: profile.features as MlFeatures,
                      predictedClass: prediction.predicted_class,
                      probabilities: prediction.probabilities,
                    },
                    skipDuplicates: true,
                  });
                  if (!saved.count) return;
                  await tx.auditoria.create({
                    data: {
                      instituicaoId: profile.instituicaoId,
                      acao: 'PREVISAO_EXPERIMENTAL_AUTOMATICA',
                      recurso: 'MATRICULA',
                      recursoId: profile.matriculaId,
                    },
                  });
                  calculated++;
                },
                { isolationLevel: 'Serializable' },
              );
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2034'
              )
                continue;
              throw error;
            }
          }
        }
      }
      if (profiles.length < PAGE_SIZE) break;
    }
    return calculated;
  }

  async recent(actor: AuthUser) {
    requireRole(actor, ['COORDENACAO']);
    const items = await this.db.previsaoAutomaticaMl.findMany({
      where: { instituicaoId: actor.instituicaoId },
      take: 50,
      orderBy: [{ calculadoEm: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
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
      origem: 'AUTOMATICA' as const,
    }));
  }
}
