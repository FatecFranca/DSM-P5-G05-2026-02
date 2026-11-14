import { ScholarshipService } from './scholarship.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('vigência da bolsa', () => {
  it('encerra a bolsa vencida e invalida o perfil uma única vez', async () => {
    const updateProfile = jest.fn().mockResolvedValue({ count: 1 });
    const createEvents = jest.fn();
    const updatePlan = jest.fn();
    const tx = {
      bolsaMatricula: {
        findUnique: jest.fn().mockResolvedValue({
          matriculaId: 'enrollment',
          instituicaoId: 'tenant',
          inicio: new Date('2026-01-01T00:00:00Z'),
          fim: new Date('2026-01-31T00:00:00Z'),
          ativa: true,
          estadoAplicado: true,
        }),
        update: updatePlan,
      },
      perfilMl: {
        findUnique: jest.fn().mockResolvedValue({
          features: { bolsista: 1, devedor: 0 },
          versao: 2,
        }),
        updateMany: updateProfile,
      },
      atributoMlEvento: { createMany: createEvents },
    };
    const db = {
      bolsaMatricula: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ matriculaId: 'enrollment' }])
          .mockResolvedValue([]),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new ScholarshipService(db as unknown as PrismaService);
    expect(
      await service.processTransitions(new Date('2026-02-01T12:00:00Z')),
    ).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: { bolsista: 0, devedor: 0 },
          versao: { increment: 1 },
        }) as unknown,
      }),
    );
    expect(createEvents).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          atributo: 'bolsista',
          valorAnterior: 1,
          valorAtual: 0,
          origem: 'BOLSA',
          versaoPerfil: 3,
        }),
      ] as unknown,
    });
    expect(updatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estadoAplicado: false } }),
    );
    expect(
      await service.processTransitions(new Date('2026-02-01T12:00:00Z')),
    ).toBe(0);
    expect(createEvents).toHaveBeenCalledTimes(1);
  });
});
