import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { AutomaticPredictionsService } from './automatic-predictions.service';
import { MlClientService } from './ml-client.service';
import { demoProfile } from './demo-profiles';
import { ACTIVE_MODEL_VERSION } from './model-version';

const admin: AuthUser = {
  id: 'admin',
  instituicaoId: 'tenant',
  perfil: 'COORDENACAO',
  sessaoId: 'session',
};
const profile = {
  matriculaId: 'enrollment',
  instituicaoId: 'tenant',
  versao: 3,
  features: demoProfile(0),
  matricula: {
    previsoesImportadas: [
      { perfilVersao: 2, modelVersion: ACTIVE_MODEL_VERSION },
    ],
  },
};

function setup(profiles: unknown[] = [profile], existing: unknown[] = []) {
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const audit = jest.fn();
  const findUnique = jest
    .fn()
    .mockResolvedValue({ versao: 3, instituicaoId: 'tenant' });
  const db = {
    perfilMl: { findMany: jest.fn().mockResolvedValue(profiles) },
    previsaoAutomaticaMl: { findMany: jest.fn().mockResolvedValue(existing) },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({
        perfilMl: { findUnique },
        previsaoAutomaticaMl: { createMany },
        auditoria: { create: audit },
      }),
    ),
  };
  const ml = {
    status: jest.fn().mockResolvedValue({
      ready: true,
      originalInputReady: true,
      modelVersion: ACTIVE_MODEL_VERSION,
    }),
    predictBatch: jest
      .fn()
      .mockImplementation((request: { items: { ref: string }[] }) =>
        Promise.resolve({
          results: request.items.map((item) => ({
            ref: item.ref,
            predicted_class: 'Dropout',
            probabilities: { Dropout: 0.7, Graduate: 0.3 },
          })),
        }),
      ),
  };
  const config = { get: jest.fn().mockReturnValue('true') };
  const service = new AutomaticPredictionsService(
    db as unknown as PrismaService,
    ml as unknown as MlClientService,
    config as unknown as ConfigService,
  );
  return { service, db, ml, createMany, audit, findUnique, config };
}

describe('recálculo experimental após alteração do perfil importado', () => {
  it('salva snapshot da nova versão sem tocar na previsão operacional', async () => {
    const { service, db, ml, createMany, audit } = setup();
    expect(await service.processPending()).toBe(1);
    expect(db.perfilMl.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matricula: { previsoesImportadas: { some: {} } } },
        take: 100,
      }),
    );
    expect(ml.predictBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        model_version: ACTIVE_MODEL_VERSION,
        input_format: 'original',
      }),
    );
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.objectContaining({
          matriculaId: 'enrollment',
          perfilVersao: 3,
          features: profile.features,
          predictedClass: 'Dropout',
        }) as unknown,
      }),
    );
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('não repete versão já calculada nem calcula perfil incompleto', async () => {
    const duplicate = setup(
      [profile],
      [{ matriculaId: 'enrollment', perfilVersao: 3 }],
    );
    expect(await duplicate.service.processPending()).toBe(0);
    expect(duplicate.ml.predictBatch).not.toHaveBeenCalled();
    const incomplete = setup([{ ...profile, features: { devedor: 1 } }]);
    expect(await incomplete.service.processPending()).toBe(0);
    expect(incomplete.ml.predictBatch).not.toHaveBeenCalled();
  });

  it('descarta cálculo se o perfil mudou durante a inferência', async () => {
    const { service, createMany, findUnique } = setup();
    findUnique.mockResolvedValue({ versao: 4, instituicaoId: 'tenant' });
    expect(await service.processPending()).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('respeita a chave de prévia e restringe o histórico ao ADMIN da instituição', async () => {
    const { service, db, ml, config } = setup([]);
    config.get.mockReturnValue('false');
    expect(await service.processPending()).toBe(0);
    expect(ml.status).not.toHaveBeenCalled();
    await expect(
      service.recent({ ...admin, perfil: 'SECRETARIA' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.recent(admin);
    expect(db.previsaoAutomaticaMl.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instituicaoId: 'tenant' } }),
    );
  });
});
