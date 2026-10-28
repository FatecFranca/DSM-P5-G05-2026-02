import { createHash, randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const secret = 'segredo-de-teste-com-mais-de-32-caracteres';
  const institutionId = randomUUID();
  const userId = randomUUID();
  const sessionId = randomUUID();
  const findUnique = jest.fn();
  const institutionFindMany = jest.fn();
  const sessionFindUnique = jest.fn();
  const sessionCreate = jest.fn().mockResolvedValue({ id: sessionId });
  const sessionUpdateMany = jest.fn();
  const auditCreate = jest.fn().mockResolvedValue({});
  const transaction = jest.fn(
    async (
      callback: (tx: {
        sessao: {
          create: typeof sessionCreate;
          updateMany: typeof sessionUpdateMany;
        };
        auditoria: { create: typeof auditCreate };
      }) => Promise<unknown>,
    ) =>
      callback({
        sessao: { create: sessionCreate, updateMany: sessionUpdateMany },
        auditoria: { create: auditCreate },
      }),
  );
  const prisma = {
    instituicao: { findMany: institutionFindMany },
    usuario: { findUnique },
    sessao: { findUnique: sessionFindUnique },
    $transaction: transaction,
  } as unknown as PrismaService;
  const config = {
    getOrThrow: () => secret,
  } as unknown as ConfigService;
  const service = new AuthService(prisma, new JwtService(), config);

  beforeEach(() => jest.clearAllMocks());

  it('lista somente instituições ativas com nome e identificador', async () => {
    institutionFindMany.mockResolvedValue([
      { id: institutionId, nome: 'Fatec São Paulo' },
    ]);
    await expect(service.listInstituicoes()).resolves.toEqual([
      { id: institutionId, nome: 'Fatec São Paulo' },
    ]);
    expect(institutionFindMany).toHaveBeenCalledWith({
      where: { ativa: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  });

  it('persiste somente o hash do refresh token', async () => {
    const senha = 'senha-segura-de-teste';
    findUnique.mockResolvedValue({
      id: userId,
      instituicaoId: institutionId,
      ativo: true,
      instituicao: { ativa: true },
      senhaHash: await argon2.hash(senha),
    });

    const result = await service.login({
      instituicaoId: institutionId,
      email: 'ADMIN@EXEMPLO.COM',
      senha,
    });

    const calls: unknown = sessionCreate.mock.calls;
    const args = (calls as Array<[{ data: { tokenHash: string } }]>)[0][0];
    expect(args.data.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(args.data.tokenHash).not.toBe(result.refreshToken);
    expect(result.expiresIn).toBe(900);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('não cria sessão com credenciais inválidas', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      service.login({
        instituicaoId: institutionId,
        email: 'ausente@exemplo.com',
        senha: 'senha-incorreta',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rotaciona o refresh token e rejeita reutilização da sessão', async () => {
    const oldToken = 'a'.repeat(64);
    sessionFindUnique.mockResolvedValue({
      id: sessionId,
      instituicaoId: institutionId,
      usuarioId: userId,
      expiraEm: new Date(Date.now() + 60_000),
      revogadaEm: null,
      usuario: { ativo: true, instituicao: { ativa: true } },
    });
    sessionUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await service.refresh({ refreshToken: oldToken });
    expect(result.refreshToken).not.toBe(oldToken);
    const createCalls: unknown = sessionCreate.mock.calls;
    const createArgs = (
      createCalls as Array<[{ data: { tokenHash: string } }]>
    )[0][0];
    expect(createArgs.data.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    const updateCalls: unknown = sessionUpdateMany.mock.calls;
    const updateArgs = (
      updateCalls as Array<[{ where: { id: string; revogadaEm: Date | null } }]>
    )[0][0];
    expect(updateArgs.where.id).toBe(sessionId);
    expect(updateArgs.where.revogadaEm).toBeNull();
    await expect(
      service.refresh({ refreshToken: oldToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionCreate).toHaveBeenCalledTimes(1);
  });

  it('revoga a sessão no logout e registra auditoria', async () => {
    sessionFindUnique.mockResolvedValue({
      id: sessionId,
      instituicaoId: institutionId,
      usuarioId: userId,
    });
    sessionUpdateMany.mockResolvedValue({ count: 1 });
    await service.logout({ refreshToken: 'b'.repeat(64) });
    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
    const auditCalls: unknown = auditCreate.mock.calls;
    const auditArgs = (
      auditCalls as Array<[{ data: { acao: string; recursoId: string } }]>
    )[0][0];
    expect(auditArgs.data.acao).toBe('LOGOUT');
    expect(auditArgs.data.recursoId).toBe(sessionId);
  });

  it('ignora logout com refresh token desconhecido', async () => {
    sessionFindUnique.mockResolvedValue(null);
    await expect(
      service.logout({ refreshToken: 'c'.repeat(64) }),
    ).resolves.toBeUndefined();
    expect(transaction).not.toHaveBeenCalled();
  });
});
