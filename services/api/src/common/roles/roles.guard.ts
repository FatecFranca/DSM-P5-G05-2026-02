import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequest } from '../../auth/auth-user';
import { ROLES_KEY } from './roles.decorator';
import { Perfil } from '../../generated/prisma/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<AuthRequest>().currentUser;
    if (!roles) {
      if (
        user?.perfil === Perfil.FINANCEIRO ||
        user?.perfil === Perfil.SECRETARIA
      )
        throw new ForbiddenException();
      return true;
    }
    if (user && roles.includes(user.perfil)) return true;
    throw new ForbiddenException();
  }
}
