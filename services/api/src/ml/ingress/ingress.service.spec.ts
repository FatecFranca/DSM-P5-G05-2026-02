import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth-user';
import { IngressService } from './ingress.service';

const actor: AuthUser = {
  id: 'secretary',
  instituicaoId: 'tenant',
  perfil: 'SECRETARIA',
  sessaoId: 'session',
};

describe('fila de ingresso da secretaria', () => {
  it('lista somente declarações pendentes na própria instituição', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new IngressService({
      declaracaoIngressoMl: { findMany },
    } as unknown as PrismaService);
    await service.pending(actor);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instituicaoId: 'tenant', pendente: true },
        take: 50,
      }),
    );
    await expect(
      service.pending({ ...actor, perfil: 'FINANCEIRO' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
