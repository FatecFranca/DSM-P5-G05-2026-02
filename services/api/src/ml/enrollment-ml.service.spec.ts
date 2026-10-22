import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EnrollmentMlService } from './enrollment-ml.service';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from './ml-client.service';
import { demoProfile } from './demo-profiles';
import type { AuthUser } from '../auth/auth-user';

describe('ML por matrícula', () => {
  const actor: AuthUser = {
    id: 'admin',
    instituicaoId: 'tenant',
    perfil: 'ADMIN',
    sessaoId: 'session',
  };
  function setup(features: Record<string, number> = demoProfile(0)) {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn();
    const db = {
      matricula: {
        findFirst: jest.fn().mockResolvedValue({
          aluno: { nome: 'Aluno' },
          registro: 'R1',
          perfilMl: { features, versao: 1, resultado: null },
        }) as unknown,
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ perfilMl: { updateMany }, auditoria: { create } }),
      ),
    };
    const ml = {
      predict: jest.fn().mockResolvedValue({
        modelVersion: 'v1',
        predictedClass: 'Graduate',
        probabilities: { Dropout: 0.1, Enrolled: 0.2, Graduate: 0.7 },
      }),
    };
    return {
      service: new EnrollmentMlService(
        db as unknown as PrismaService,
        ml as unknown as MlClientService,
      ),
      db,
      ml,
      updateMany,
      create,
    };
  }
  it('não inventa os atributos ausentes nem chama ML', async () => {
    const { service, ml } = setup({ pib: 1 });
    const response = await service.analyze(actor, 'matricula');
    expect(response.status).toBe('INSUFICIENTE');
    expect(response.faltantes).toHaveLength(35);
    expect(ml.predict).not.toHaveBeenCalled();
  });
  it('consulta dados persistidos e grava snapshot, versão e probabilidades', async () => {
    const { service, ml, updateMany } = setup();
    const result = await service.analyze(actor, 'matricula');
    expect(result.status).toBe('CALCULADO');
    expect(ml.predict).toHaveBeenCalledWith(demoProfile(0), 'original');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matriculaId: 'matricula', instituicaoId: 'tenant', versao: 1 },
        data: {
          resultado: expect.objectContaining({
            features: demoProfile(0),
            perfilVersao: 1,
          }) as unknown,
        },
      }),
    );
    expect(result.resultado).not.toHaveProperty('features');
  });
  it('recusa gravação se o perfil mudou durante a inferência', async () => {
    const { service, updateMany, create } = setup();
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.analyze(actor, 'matricula')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('falha do modelo não salva um resultado', async () => {
    const { service, ml, updateMany } = setup();
    ml.predict.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.analyze(actor, 'matricula')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('aluno não consulta risco; professor não edita nem recebe perfil sensível', async () => {
    const { service, db } = setup();
    await expect(
      service.get({ ...actor, perfil: 'ALUNO' }, 'matricula'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const teacher = { ...actor, perfil: 'PROFESSOR' as const };
    await expect(
      service.save(teacher, 'matricula', { versao: 1, features: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.get(teacher, 'matricula')).features).toBeUndefined();
    expect(db.matricula.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instituicaoId: 'tenant',
          turma: expect.any(Object) as unknown,
        }) as unknown,
      }),
    );
  });
});
