import { randomUUID } from 'node:crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Perfil } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC } from '../public.decorator';
import { AccessGuard } from './access.guard';

describe('AccessGuard', () => {
  const secret = 'segredo-de-teste-com-mais-de-32-caracteres';
  const jwt = new JwtService();
  const findFirst = jest.fn();
  const config = {
    getOrThrow: () => secret,
  } as unknown as ConfigService;
  const prisma = { sessao: { findFirst } } as unknown as PrismaService;
  const guard = new AccessGuard(new Reflector(), jwt, config, prisma);
  const userId = randomUUID();
  const sessionId = randomUUID();
  const institutionId = randomUUID();

  function context(authorization?: string, publicRoute = false) {
    const request = { headers: { authorization } };
    const handler = () => undefined;
    if (publicRoute) Reflect.defineMetadata(IS_PUBLIC, true, handler);
    return {
      request,
      executionContext: {
        getHandler: () => handler,
        getClass: () => class TestController {},
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('permite rota pública sem consultar sessão', async () => {
    await expect(
      guard.canActivate(context(undefined, true).executionContext),
    ).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejeita cabeçalho ausente ou JWT inválido', async () => {
    await expect(
      guard.canActivate(context().executionContext),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(context('Bearer inválido').executionContext),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejeita token sem sessão ativa', async () => {
    const token = await jwt.signAsync(
      { sub: userId, sid: sessionId },
      { secret, issuer: 'sgei-api', audience: 'sgei-api' },
    );
    findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(context(`Bearer ${token}`).executionContext),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deriva instituição e perfil da sessão no banco', async () => {
    const token = await jwt.signAsync(
      { sub: userId, sid: sessionId, perfil: Perfil.ADMIN },
      { secret, issuer: 'sgei-api', audience: 'sgei-api' },
    );
    findFirst.mockResolvedValue({
      id: sessionId,
      instituicaoId: institutionId,
      usuario: {
        id: userId,
        perfil: Perfil.ALUNO,
        ativo: true,
        instituicao: { ativa: true },
      },
    });
    const { request, executionContext } = context(`Bearer ${token}`);
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request).toHaveProperty('currentUser.instituicaoId', institutionId);
    expect(request).toHaveProperty('currentUser.perfil', Perfil.ALUNO);
    const calls: unknown = findFirst.mock.calls;
    const args = (
      calls as Array<
        [
          {
            where: { id: string; usuarioId: string };
          },
        ]
      >
    )[0][0];
    expect(args.where.id).toBe(sessionId);
    expect(args.where.usuarioId).toBe(userId);
  });

  it('rejeita usuário ou instituição desativados', async () => {
    const token = await jwt.signAsync(
      { sub: userId, sid: sessionId },
      { secret, issuer: 'sgei-api', audience: 'sgei-api' },
    );
    findFirst.mockResolvedValue({
      id: sessionId,
      instituicaoId: institutionId,
      usuario: {
        id: userId,
        perfil: Perfil.ADMIN,
        ativo: true,
        instituicao: { ativa: false },
      },
    });
    await expect(
      guard.canActivate(context(`Bearer ${token}`).executionContext),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
