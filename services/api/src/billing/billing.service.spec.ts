import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingService,
  businessDate,
  monthlyDue,
  semesterForMonth,
} from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';

const actor: AuthUser = {
  id: 'admin',
  instituicaoId: 'tenant',
  perfil: 'ADMIN',
  sessaoId: 'session',
};

describe('vencimento e pagamento de mensalidades', () => {
  it('busca matrículas do financeiro somente na instituição da sessão', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new BillingService({
      matricula: { findMany },
    } as unknown as PrismaService);
    await service.searchEnrollments(
      { ...actor, perfil: 'FINANCEIRO' },
      ' 2026',
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instituicaoId: 'tenant',
          registro: { startsWith: '2026', mode: 'insensitive' },
        },
        take: 20,
      }),
    );
    await expect(
      service.searchEnrollments({ ...actor, perfil: 'ALUNO' }, '2026'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('consulta o plano mensal sem expor matrículas de outra instituição', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ planoMensalidade: null })
      .mockResolvedValueOnce(null);
    const service = new BillingService({
      matricula: { findFirst },
    } as unknown as PrismaService);
    expect(
      await service.getMonthlyPlan(
        { ...actor, perfil: 'FINANCEIRO' },
        'enrollment',
      ),
    ).toBeNull();
    await expect(
      service.getMonthlyPlan({ ...actor, perfil: 'FINANCEIRO' }, 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign', instituicaoId: 'tenant' },
      }),
    );
  });
  it('usa a data civil de São Paulo na virada do dia', () => {
    expect(businessDate(new Date('2026-11-05T02:59:59Z')).toISOString()).toBe(
      '2026-11-04T00:00:00.000Z',
    );
    expect(businessDate(new Date('2026-11-05T03:00:00Z')).toISOString()).toBe(
      '2026-11-05T00:00:00.000Z',
    );
  });

  it('ajusta o vencimento mensal ao último dia de fevereiro', () => {
    expect(monthlyDue(new Date('2027-02-01T00:00:00Z'), 31).toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });

  it('atribui competências a semestres de seis meses', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    expect(semesterForMonth(start, new Date('2026-06-01T00:00:00Z'))).toBe(1);
    expect(semesterForMonth(start, new Date('2026-07-01T00:00:00Z'))).toBe(2);
    expect(() =>
      semesterForMonth(start, new Date('2025-12-01T00:00:00Z')),
    ).toThrow(BadRequestException);
  });

  it('limita o plano mensal à duração do curso', async () => {
    const tx = {
      matricula: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enrollment',
          turma: { duracaoSemestres: 2 },
        }),
      },
      planoMensalidade: { upsert: jest.fn() },
    };
    const db = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BillingService(db as unknown as PrismaService);
    await expect(
      service.setMonthlyPlan(actor, 'enrollment', {
        inicioCompetencia: '2026-01',
        fimCompetencia: '2027-01',
        valorCentavos: 10000,
        diaVencimento: 10,
        ativo: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.planoMensalidade.upsert).not.toHaveBeenCalled();
  });

  it('gera uma fatura mensal e avança a competência sem duplicar a cobrança', async () => {
    const month = new Date('2026-11-01T00:00:00Z');
    const plan = {
      matriculaId: 'enrollment',
      instituicaoId: 'tenant',
      inicioCompetencia: month,
      proximaCompetencia: month,
      fimCompetencia: null,
      diaVencimento: 15,
      valorCentavos: 10000,
      ativo: true,
    };
    const tx = {
      planoMensalidade: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(plan)
          .mockResolvedValue({
            ...plan,
            proximaCompetencia: new Date('2026-12-01T00:00:00Z'),
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      fatura: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'invoice' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      perfilMl: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      atributoMlEvento: { createMany: jest.fn() },
      auditoria: { create: jest.fn() },
    };
    const db = {
      planoMensalidade: {
        findMany: jest.fn().mockResolvedValue([{ matriculaId: 'enrollment' }]),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BillingService(db as unknown as PrismaService);
    expect(await service.processMonthly(new Date('2026-11-04T12:00:00Z'))).toBe(
      1,
    );
    expect(tx.fatura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          competencia: month,
          semestre: 1,
          vencimento: new Date('2026-11-15T00:00:00Z'),
        }) as unknown,
      }),
    );
    expect(tx.planoMensalidade.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proximaCompetencia: new Date('2026-12-01T00:00:00Z'),
        }) as unknown,
      }),
    );
    expect(await service.processMonthly(new Date('2026-11-04T12:00:00Z'))).toBe(
      0,
    );
    expect(tx.fatura.create).toHaveBeenCalledTimes(1);
  });

  it('ao vencer a fatura, deriva os dois atributos e invalida o resultado anterior', async () => {
    const updateProfile = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      fatura: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([
          {
            vencimento: new Date('2026-11-04T00:00:00Z'),
            valorCentavos: 10000,
            pagoCentavos: 0,
          },
        ]),
      },
      perfilMl: {
        findUnique: jest.fn().mockResolvedValue({
          versao: 2,
          features: { devedor: 0, mensalidade_em_dia: 1, curso: 33 },
        }),
        updateMany: updateProfile,
      },
      atributoMlEvento: { createMany: jest.fn() },
      auditoria: { create: jest.fn() },
    };
    const db = {
      fatura: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'invoice',
            instituicaoId: 'tenant',
            matriculaId: 'enrollment',
          },
        ]),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BillingService(db as unknown as PrismaService);
    expect(await service.processOverdue(new Date('2026-11-05T12:00:00Z'))).toBe(
      1,
    );
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matriculaId: 'enrollment',
          instituicaoId: 'tenant',
          versao: 2,
        },
        data: expect.objectContaining({
          features: { devedor: 1, mensalidade_em_dia: 0, curso: 33 },
          versao: { increment: 1 },
        }) as unknown,
      }),
    );
    expect(tx.auditoria.create).toHaveBeenCalled();
    expect(tx.atributoMlEvento.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          atributo: 'devedor',
          valorAnterior: 0,
          valorAtual: 1,
          versaoPerfil: 3,
          origem: 'FINANCEIRO',
        }),
        expect.objectContaining({
          atributo: 'mensalidade_em_dia',
          valorAnterior: 1,
          valorAtual: 0,
          versaoPerfil: 3,
          origem: 'FINANCEIRO',
        }),
      ]) as unknown,
    });
  });

  it('ao quitar, restaura os atributos financeiros e rejeita pagamento acima do saldo', async () => {
    const invoice = {
      id: 'invoice',
      instituicaoId: 'tenant',
      matriculaId: 'enrollment',
      vencimento: new Date('2026-11-01T00:00:00Z'),
      valorCentavos: 10000,
      pagoCentavos: 3000,
    };
    const tx = {
      fatura: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pagamentoFatura: {
        create: jest.fn().mockResolvedValue({ id: 'payment' }),
      },
      perfilMl: {
        findUnique: jest.fn().mockResolvedValue({
          versao: 3,
          features: { devedor: 1, mensalidade_em_dia: 0 },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      atributoMlEvento: { createMany: jest.fn() },
      auditoria: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BillingService(db as unknown as PrismaService);
    await service.recordPayment(actor, 'invoice', {
      referencia: 'banco-0001',
      valorCentavos: 7000,
    });
    expect(tx.fatura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pagoCentavos: 10000, situacao: 'QUITADA' },
      }),
    );
    expect(tx.perfilMl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: { devedor: 0, mensalidade_em_dia: 1 },
        }) as unknown,
      }),
    );
    await expect(
      service.recordPayment(actor, 'invoice', {
        referencia: 'banco-0002',
        valorCentavos: 7001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não expõe faturas de uma matrícula alheia ao aluno', async () => {
    const db = {
      matricula: { findFirst: jest.fn().mockResolvedValue(null) },
      fatura: { findMany: jest.fn() },
    };
    const service = new BillingService(db as unknown as PrismaService);
    await expect(
      service.list({ ...actor, perfil: 'ALUNO' }, 'other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.matricula.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other', instituicaoId: 'tenant', alunoId: 'admin' },
      }),
    );
    expect(db.fatura.findMany).not.toHaveBeenCalled();
  });

  it('simula o pagamento integral só para o aluno dono da fatura', async () => {
    const invoice = {
      id: 'invoice',
      instituicaoId: 'tenant',
      matriculaId: 'enrollment',
      vencimento: new Date('2026-11-01T00:00:00Z'),
      valorCentavos: 10000,
      pagoCentavos: 3000,
    };
    const tx = {
      fatura: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pagamentoFatura: {
        create: jest.fn().mockResolvedValue({ id: 'payment' }),
      },
      perfilMl: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      atributoMlEvento: { createMany: jest.fn() },
      auditoria: { create: jest.fn() },
    };
    const db = {
      fatura: { findFirst: jest.fn().mockResolvedValue(invoice) },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BillingService(db as unknown as PrismaService);
    const previousFlag = process.env.SIMULATED_PAYMENTS_ENABLED;
    process.env.SIMULATED_PAYMENTS_ENABLED = 'false';
    await expect(
      service.simulatePayment({ ...actor, perfil: 'ALUNO' }, 'invoice'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    process.env.SIMULATED_PAYMENTS_ENABLED = 'true';
    await service.simulatePayment(
      { ...actor, perfil: 'ALUNO' },
      'invoice',
      new Date('2026-11-05T12:00:00Z'),
    );
    expect(db.fatura.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invoice',
          instituicaoId: 'tenant',
          matricula: { alunoId: 'admin' },
        },
      }),
    );
    expect(tx.fatura.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invoice',
          instituicaoId: 'tenant',
          matricula: { alunoId: 'admin' },
        },
      }),
    );
    expect(tx.pagamentoFatura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          valorCentavos: 7000,
          simulado: true,
          referencia: expect.stringMatching(/^SIM-/) as unknown,
        }) as unknown,
      }),
    );
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acao: 'SIMULAR_PAGAMENTO' }) as unknown,
      }),
    );
    db.fatura.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.simulatePayment({ ...actor, perfil: 'ALUNO' }, 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.simulatePayment(actor, 'invoice'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    if (previousFlag === undefined)
      delete process.env.SIMULATED_PAYMENTS_ENABLED;
    else process.env.SIMULATED_PAYMENTS_ENABLED = previousFlag;
  });

  it('autoriza financeiro no próprio tenant e nega secretaria', async () => {
    const db = {
      matricula: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enrollment' }),
      },
      fatura: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new BillingService(db as unknown as PrismaService);
    await service.list({ ...actor, perfil: 'FINANCEIRO' }, 'enrollment');
    expect(db.matricula.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enrollment', instituicaoId: 'tenant' },
      }),
    );
    await expect(
      service.list({ ...actor, perfil: 'SECRETARIA' }, 'enrollment'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.fatura.findMany).toHaveBeenCalledTimes(1);
  });
});
