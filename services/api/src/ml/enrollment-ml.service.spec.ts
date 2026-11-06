import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EnrollmentMlService } from './enrollment-ml.service';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from './ml-client.service';
import { demoProfile } from './demo-profiles';
import { FATEC_DEMO_ML_SOURCE } from './fatec-demo-profile';
import type { AuthUser } from '../auth/auth-user';
import { TurnoDeclarado } from './dto/self-report.dto';

describe('ML por matrícula', () => {
  const actor: AuthUser = {
    id: 'admin',
    instituicaoId: 'tenant',
    perfil: 'COORDENACAO',
    sessaoId: 'session',
  };
  function setup(features: Record<string, number> = demoProfile(0)) {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const upsert = jest.fn().mockResolvedValue({});
    const createEvents = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn();
    const findInvoices = jest.fn().mockResolvedValue([]);
    const findScholarship = jest.fn().mockResolvedValue(null);
    const db = {
      matricula: {
        findFirst: jest.fn().mockResolvedValue({
          instituicaoId: 'tenant',
          aluno: { nome: 'Aluno' },
          registro: 'R1',
          perfilMl: { features, versao: 1, resultado: null },
        }) as unknown,
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({
          matricula: {
            findFirst: jest
              .fn()
              .mockResolvedValue({ perfilMl: { features, versao: 1 } }),
          },
          perfilMl: { updateMany, upsert },
          atributoMlEvento: { createMany: createEvents },
          fatura: { findMany: findInvoices },
          bolsaMatricula: { findUnique: findScholarship },
          resumoSemestreMl: { findMany: jest.fn().mockResolvedValue([]) },
          indicadorMacro: { findUnique: jest.fn().mockResolvedValue(null) },
          fonteIngressoMl: { findUnique: jest.fn().mockResolvedValue(null) },
          auditoria: { create },
        }),
      ),
    };
    const ml = {
      operationalEligibility: jest
        .fn()
        .mockReturnValue({ valid: true, reason: '' }),
      preview: jest.fn().mockResolvedValue({
        modelVersion: 'v1',
        predictedClass: 'Graduate',
        probabilities: { Dropout: 0.1, Enrolled: 0.2, Graduate: 0.7 },
      }),
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
      upsert,
      createEvents,
      create,
      findInvoices,
      findScholarship,
    };
  }
  it('não inventa os atributos ausentes nem chama ML', async () => {
    const { service, ml } = setup({ pib: 1 });
    const response = await service.analyze(actor, 'matricula');
    expect(response.status).toBe('INSUFICIENTE');
    expect(response.faltantes).toHaveLength(35);
    expect(ml.predict).not.toHaveBeenCalled();
  });
  it('não gera previsão operacional sem validação institucional', async () => {
    const { service, ml, updateMany } = setup();
    ml.operationalEligibility.mockReturnValue({
      valid: false,
      reason: 'Validação local ausente',
    });
    const result = await service.analyze(actor, 'matricula');
    expect(result.status).toBe('INSUFICIENTE');
    expect(result.impedimentos).toContain('Validação local ausente');
    expect(ml.predict).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('mostra prévia apenas da matrícula fictícia e sem salvar resultado operacional', async () => {
    const { service, db, ml, updateMany } = setup();
    (db.matricula.findFirst as jest.Mock).mockResolvedValue({
      instituicaoId: 'tenant',
      registro: 'SGEI-DEMO-109',
      aluno: { nome: 'Aluno Demo SGEI' },
      perfilMl: {
        features: demoProfile(0),
        versao: 1,
        fonte: FATEC_DEMO_ML_SOURCE,
        resultado: null,
      },
    });
    const result = await service.demoPreview(actor, 'matricula');
    expect(result.demonstracao).toBe(true);
    expect(ml.preview).toHaveBeenCalledWith(demoProfile(0), 'original');
    expect(updateMany).not.toHaveBeenCalled();
    await expect(
      service.demoPreview({ ...actor, perfil: 'ALUNO' }, 'matricula'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('não exibe a prévia para um perfil comum ou incompleto', async () => {
    const { service, db, ml } = setup();
    await expect(
      service.demoPreview(actor, 'matricula'),
    ).rejects.toBeInstanceOf(NotFoundException);
    (db.matricula.findFirst as jest.Mock).mockResolvedValue({
      instituicaoId: 'tenant',
      registro: 'SGEI-DEMO-109',
      aluno: { nome: 'Aluno Demo SGEI' },
      perfilMl: {
        features: {},
        versao: 1,
        fonte: FATEC_DEMO_ML_SOURCE,
        resultado: null,
      },
    });
    await expect(
      service.demoPreview(actor, 'matricula'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ml.preview).not.toHaveBeenCalled();
  });
  it('converte respostas do aluno no servidor sem revelar códigos nem risco', async () => {
    const { service, upsert, createEvents } = setup({});
    const student = { ...actor, perfil: 'ALUNO' as const };
    const response = await service.saveSelfReport(student, 'matricula', {
      idadeNoIngresso: 22,
      turno: TurnoDeclarado.NOTURNO,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          features: { idade_matricula: 22, periodo_aula: 0 },
        }) as unknown,
      }),
    );
    expect(response).not.toHaveProperty('features');
    expect(response).not.toHaveProperty('resultado');
    expect(createEvents).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          atributo: 'idade_matricula',
          origem: 'AUTODECLARACAO',
          versaoPerfil: 2,
          valorAtual: 22,
        }),
        expect.objectContaining({
          atributo: 'periodo_aula',
          origem: 'AUTODECLARACAO',
          versaoPerfil: 2,
          valorAtual: 0,
        }),
      ]) as unknown,
    });
  });
  it('nega autodeclaração de matrícula alheia', async () => {
    const { service, db } = setup({});
    (db.matricula.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.getSelfReport({ ...actor, perfil: 'ALUNO' }, 'outra'),
    ).rejects.toBeInstanceOf(NotFoundException);
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
  it('permite ao administrador analisar apenas matrícula da própria instituição', async () => {
    const { service, db, updateMany, create } = setup();
    (db.matricula.findFirst as jest.Mock).mockResolvedValue({
      instituicaoId: 'tenant',
      aluno: { nome: 'Aluna da instituição' },
      registro: 'F1',
      perfilMl: { features: demoProfile(0), versao: 1, resultado: null },
    });
    const result = await service.analyze(actor, 'matricula-franca');
    expect(result.status).toBe('CALCULADO');
    expect(result).not.toHaveProperty('instituicaoId');
    expect(db.matricula.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'matricula-franca',
          instituicaoId: 'tenant',
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matriculaId: 'matricula-franca',
          instituicaoId: 'tenant',
          versao: 1,
        },
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instituicaoId: actor.instituicaoId,
          autorId: actor.id,
          recursoId: 'matricula-franca',
        }) as unknown,
      }),
    );
  });
  it('recusa salvar perfil de matrícula de outra instituição', async () => {
    const { service, db, updateMany, create } = setup();
    (db.matricula.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.save(actor, 'matricula-franca', {
        versao: 1,
        features: { idade_matricula: 22 },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.matricula.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'matricula-franca', instituicaoId: actor.instituicaoId },
      }),
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('preserva os indicadores calculados pelas faturas e recusa edição manual conflitante', async () => {
    const { service, findInvoices, updateMany, createEvents } = setup();
    findInvoices.mockResolvedValue([
      {
        vencimento: new Date('2000-01-01T00:00:00Z'),
        pagoCentavos: 0,
        valorCentavos: 10000,
      },
    ]);
    await service.save(actor, 'matricula', {
      versao: 1,
      features: { idade_matricula: 22 },
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: { idade_matricula: 22, devedor: 1, mensalidade_em_dia: 0 },
        }) as unknown,
      }),
    );
    expect(createEvents).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          atributo: 'devedor',
          origem: 'FINANCEIRO',
          valorAtual: 1,
        }),
        expect.objectContaining({
          atributo: 'mensalidade_em_dia',
          origem: 'FINANCEIRO',
          valorAtual: 0,
        }),
      ]) as unknown,
    });
    await expect(
      service.save(actor, 'matricula', {
        versao: 1,
        features: { devedor: 0, mensalidade_em_dia: 1 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
  it('preserva o indicador de bolsa aprovado e recusa edição manual conflitante', async () => {
    const { service, findScholarship, updateMany, createEvents } = setup();
    findScholarship.mockResolvedValue({
      inicio: new Date('2000-01-01T00:00:00Z'),
      fim: null,
      ativa: true,
    });
    await service.save(actor, 'matricula', {
      versao: 1,
      features: { idade_matricula: 22 },
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: { idade_matricula: 22, bolsista: 1 },
        }) as unknown,
      }),
    );
    expect(createEvents).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ atributo: 'bolsista', origem: 'BOLSA' }),
      ]) as unknown,
    });
    await expect(
      service.save(actor, 'matricula', {
        versao: 1,
        features: { bolsista: 0 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
