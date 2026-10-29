import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Perfil } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService: isolamento por instituição', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn();
  const institutionFindFirst = jest.fn();
  const create = jest.fn();
  const auditCreate = jest.fn();
  const transaction = jest.fn(
    async (
      input:
        | Promise<unknown>[]
        | ((tx: {
            usuario: { create: typeof create };
            auditoria: { create: typeof auditCreate };
          }) => Promise<unknown>),
    ) =>
      Array.isArray(input)
        ? Promise.all(input)
        : input({ usuario: { create }, auditoria: { create: auditCreate } }),
  );
  const prisma = {
    usuario: { findMany, findFirst, count },
    instituicao: { findFirst: institutionFindFirst },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new UsersService(prisma);
  const actor = {
    id: 'admin-id',
    instituicaoId: 'instituicao-a',
    perfil: Perfil.ADMIN,
    sessaoId: 'sessao-id',
  };
  const dto = {
    email: ' NOVO@EXEMPLO.COM ',
    nome: ' Novo Usuário ',
    senha: 'senha-segura-de-teste',
    perfil: Perfil.PROFESSOR,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    institutionFindFirst.mockResolvedValue({ id: 'instituicao-a' });
  });

  it('permite ao administrador consultar as quatro Fatecs sem expor hash', async () => {
    findMany.mockResolvedValue([]);
    await service.list(actor);
    const calls: unknown = findMany.mock.calls;
    const args = (
      calls as Array<
        [
          {
            where: { AND: Array<{ OR?: unknown[] }> };
            select: Record<string, boolean>;
          },
        ]
      >
    )[0][0];
    expect(args.where.AND[0].OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instituicaoId: actor.instituicaoId }),
        expect.objectContaining({ instituicao: expect.any(Object) as unknown }),
      ]),
    );
    expect(args.select.senhaHash).toBeUndefined();
  });

  it('restringe professor aos alunos das suas turmas', async () => {
    findMany.mockResolvedValue([]);
    await service.list({ ...actor, perfil: Perfil.PROFESSOR });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              instituicaoId: actor.instituicaoId,
              perfil: 'ALUNO',
              matriculas: { some: expect.any(Object) as unknown },
            }),
          ],
        },
      }),
    );
  });

  it('pagina com o mesmo escopo e filtros sem mudar a resposta legada', async () => {
    findMany.mockResolvedValue([{ id: 'aluno-a' }]);
    count.mockResolvedValue(26);
    const professor = { ...actor, perfil: Perfil.PROFESSOR };
    await expect(
      service.list(professor, {
        pagina: 2,
        tamanho: 25,
        instituicaoId: actor.instituicaoId,
        perfil: Perfil.ALUNO,
        busca: 'Ana',
      }),
    ).resolves.toEqual({
      itens: [{ id: 'aluno-a' }],
      total: 26,
      pagina: 2,
      tamanho: 25,
    });
    const args = (
      findMany.mock.calls as unknown as Array<
        [{ where: unknown; skip: number; take: number }]
      >
    )[0][0];
    expect(args.skip).toBe(25);
    expect(args.take).toBe(25);
    expect(args.where).toEqual({
      AND: [
        expect.objectContaining({
          instituicaoId: actor.instituicaoId,
          matriculas: { some: expect.any(Object) as unknown },
        }),
        { instituicaoId: actor.instituicaoId },
        { perfil: Perfil.ALUNO },
        {
          OR: [
            { nome: { contains: 'Ana', mode: 'insensitive' } },
            { email: { contains: 'Ana', mode: 'insensitive' } },
          ],
        },
      ],
    });
    expect(count).toHaveBeenCalledWith({ where: args.where });
  });

  it('não encontra usuário fora do escopo', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      service.findOne({ ...actor, perfil: Perfil.PROFESSOR }, 'usuario-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [expect.any(Object) as unknown, { id: 'usuario-b' }] },
      }),
    );
  });

  it('cria usuário apenas na instituição do administrador e audita', async () => {
    create.mockResolvedValue({ id: 'novo-id' });
    auditCreate.mockResolvedValue({});
    await service.create(actor, dto);
    const calls: unknown = create.mock.calls;
    const args = (
      calls as Array<
        [
          {
            data: {
              instituicaoId: string;
              email: string;
              nome: string;
              senhaHash: string;
            };
            select: Record<string, boolean>;
          },
        ]
      >
    )[0][0];
    expect(args.data.instituicaoId).toBe(actor.instituicaoId);
    expect(args.data.email).toBe('novo@exemplo.com');
    expect(args.data.nome).toBe('Novo Usuário');
    expect(await argon2.verify(args.data.senhaHash, dto.senha)).toBe(true);
    expect(args.select.senhaHash).toBeUndefined();
    const auditCalls: unknown = auditCreate.mock.calls;
    const auditArgs = (
      auditCalls as Array<
        [
          {
            data: { instituicaoId: string; autorId: string; recursoId: string };
          },
        ]
      >
    )[0][0];
    expect(auditArgs.data.instituicaoId).toBe(actor.instituicaoId);
    expect(auditArgs.data.autorId).toBe(actor.id);
    expect(auditArgs.data.recursoId).toBe('novo-id');
  });

  it('recusa Fatec fora do conjunto permitido', async () => {
    institutionFindFirst.mockResolvedValue(null);
    await expect(
      service.create(actor, { ...dto, instituicaoId: 'outra' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejeita nome composto apenas por espaços', async () => {
    await expect(
      service.create(actor, { ...dto, nome: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('traduz violação de e-mail único em conflito', async () => {
    create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create(actor, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
