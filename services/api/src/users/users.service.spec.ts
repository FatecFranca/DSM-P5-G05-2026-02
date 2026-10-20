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
  const findFirst = jest.fn();
  const create = jest.fn();
  const auditCreate = jest.fn();
  const transaction = jest.fn(
    async (
      callback: (tx: {
        usuario: { create: typeof create };
        auditoria: { create: typeof auditCreate };
      }) => Promise<unknown>,
    ) => callback({ usuario: { create }, auditoria: { create: auditCreate } }),
  );
  const prisma = {
    usuario: { findMany, findFirst },
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

  beforeEach(() => jest.clearAllMocks());

  it('filtra a listagem pela instituição do usuário autenticado', async () => {
    findMany.mockResolvedValue([]);
    await service.list('instituicao-a');
    const calls: unknown = findMany.mock.calls;
    const args = (
      calls as Array<
        [
          {
            where: { instituicaoId: string };
            select: Record<string, boolean>;
          },
        ]
      >
    )[0][0];
    expect(args.where.instituicaoId).toBe('instituicao-a');
    expect(args.select.senhaHash).toBeUndefined();
  });

  it('não encontra usuário fora da instituição', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      service.findOne('instituicao-a', 'usuario-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'usuario-b', instituicaoId: 'instituicao-a' },
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
