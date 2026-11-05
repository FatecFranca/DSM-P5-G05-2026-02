import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FATEC_DEMO_ML_SOURCE,
  FATEC_DEMO_REGISTRATIONS,
} from './fatec-demo-profile';
import { MlClientService } from './ml-client.service';
import { ML_FEATURES, type MlFeatures } from './ml.types';
import { validProfile } from './profile-validation';

@Injectable()
export class DemoAnalysisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoAnalysisService.name);
  private timer?: ReturnType<typeof setInterval>;

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
    void this.processPending().catch(() => {
      this.logger.warn(
        'Prévia automática demonstrativa indisponível; nova tentativa agendada',
      );
    });
  }

  async processPending() {
    if (this.config.get<string>('ML_PREVIEW_ENABLED') !== 'true') return 0;
    const model = await this.ml.status();
    if (!model.ready || !model.modelVersion) return 0;
    const outdated = {
      OR: [
        { resultado: { equals: Prisma.DbNull } },
        { resultado: { path: ['modelVersion'], not: model.modelVersion } },
      ],
    };
    const pending = await this.db.perfilMl.findMany({
      where: {
        fonte: FATEC_DEMO_ML_SOURCE,
        ...outdated,
      },
      include: {
        matricula: {
          select: { registro: true, aluno: { select: { nome: true } } },
        },
      },
      take: 100,
    });
    let calculated = 0;
    for (const profile of pending) {
      if (
        profile.fonte !== FATEC_DEMO_ML_SOURCE ||
        profile.matricula.aluno.nome !== 'Aluno Demo SGEI' ||
        !FATEC_DEMO_REGISTRATIONS.includes(profile.matricula.registro)
      )
        continue;
      const features: unknown = profile.features;
      if (
        !validProfile(features) ||
        ML_FEATURES.some((name) => !Number.isFinite(features[name]))
      )
        continue;
      const prediction = await this.ml.preview(
        features as MlFeatures,
        'original',
      );
      const result = {
        ...prediction,
        demonstracao: true,
        calculadoEm: new Date().toISOString(),
        perfilVersao: profile.versao,
        features,
      };
      await this.db.$transaction(
        async (tx) => {
          const updated = await tx.perfilMl.updateMany({
            where: {
              matriculaId: profile.matriculaId,
              instituicaoId: profile.instituicaoId,
              versao: profile.versao,
              ...outdated,
            },
            data: { resultado: result },
          });
          if (!updated.count) return;
          await tx.auditoria.create({
            data: {
              instituicaoId: profile.instituicaoId,
              acao: 'PREVISAO_DEMO_AUTOMATICA',
              recurso: 'MATRICULA',
              recursoId: profile.matriculaId,
            },
          });
          calculated += 1;
        },
        { isolationLevel: 'Serializable' },
      );
    }
    return calculated;
  }
}
