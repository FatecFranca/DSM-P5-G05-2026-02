import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil } from '../../generated/prisma/enums';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const handler = () => undefined;
  Reflect.defineMetadata(ROLES_KEY, [Perfil.ADMIN], handler);
  const guard = new RolesGuard(new Reflector());

  function context(perfil: Perfil): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ currentUser: { perfil } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite ADMIN', () => {
    expect(guard.canActivate(context(Perfil.ADMIN))).toBe(true);
  });

  it.each([Perfil.COORDENACAO, Perfil.PROFESSOR, Perfil.TUTOR, Perfil.ALUNO])(
    'nega acesso ao perfil %s',
    (perfil) => {
      expect(() => guard.canActivate(context(perfil))).toThrow(
        ForbiddenException,
      );
    },
  );
});
