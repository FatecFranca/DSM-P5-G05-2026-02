import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DemoAnalysisService } from './demo-analysis.service';
import { MlClientService } from './ml-client.service';
import { demoProfile } from './demo-profiles';
import { FATEC_DEMO_ML_SOURCE } from './fatec-demo-profile';

describe('recálculo automático da prévia sintética', () => {
  const profile = {
    matriculaId: 'enrollment',
    instituicaoId: 'tenant',
    versao: 4,
    fonte: FATEC_DEMO_ML_SOURCE,
    resultado: null,
    features: demoProfile(0),
    matricula: {
      registro: 'SGEI-DEMO-109',
      aluno: { nome: 'Aluno Demo SGEI' },
    },
  };

  function setup(profiles: unknown[] = [profile], enabled = 'true') {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn();
    const db = {
      perfilMl: { findMany: jest.fn().mockResolvedValue(profiles) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ perfilMl: { updateMany }, auditoria: { create } }),
      ),
    };
    const ml = {
      status: jest
        .fn()
        .mockResolvedValue({ ready: true, modelVersion: 'evasao-baseline-v2' }),
      preview: jest.fn().mockResolvedValue({
        modelVersion: 'evasao-baseline-v2',
        predictedClass: 'Enrolled',
        probabilities: { Dropout: 0.2, Enrolled: 0.6, Graduate: 0.2 },
      }),
    };
    const config = { get: jest.fn().mockReturnValue(enabled) };
    return {
      service: new DemoAnalysisService(
        db as unknown as PrismaService,
        ml as unknown as MlClientService,
        config as unknown as ConfigService,
      ),
      db,
      ml,
      updateMany,
      create,
    };
  }

  it('calcula e grava somente uma prévia demo completa na versão lida', async () => {
    const { service, ml, updateMany, create } = setup();
    expect(await service.processPending()).toBe(1);
    expect(ml.preview).toHaveBeenCalledWith(profile.features, 'original');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matriculaId: 'enrollment',
          versao: 4,
        }) as unknown,
        data: {
          resultado: expect.objectContaining({
            demonstracao: true,
            perfilVersao: 4,
            features: profile.features,
          }) as unknown,
        },
      }),
    );
    expect(create).toHaveBeenCalled();
  });

  it('não calcula matrícula comum, incompleta ou com prévia desabilitada', async () => {
    const nonDemo = { ...profile, fonte: 'Cadastro institucional' };
    const incomplete = { ...profile, features: { devedor: 1 } };
    const { service, ml } = setup([nonDemo, incomplete]);
    expect(await service.processPending()).toBe(0);
    expect(ml.preview).not.toHaveBeenCalled();
    const disabled = setup([profile], 'false');
    expect(await disabled.service.processPending()).toBe(0);
    expect(disabled.db.perfilMl.findMany).not.toHaveBeenCalled();
  });

  it('recalcula prévia sintética quando a versão ativa muda', async () => {
    const outdated = {
      ...profile,
      resultado: { modelVersion: 'evasao-baseline-v2' },
    };
    const { service, ml, db } = setup([outdated]);
    ml.status.mockResolvedValue({
      ready: true,
      modelVersion: 'externo-lr-sem-enrolled-v1',
    });
    ml.preview.mockResolvedValue({
      modelVersion: 'externo-lr-sem-enrolled-v1',
      predictedClass: 'Dropout',
      probabilities: { Dropout: 0.7, Graduate: 0.3 },
    });
    expect(await service.processPending()).toBe(1);
    expect(db.perfilMl.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array) as unknown,
        }) as unknown,
      }),
    );
  });
});
