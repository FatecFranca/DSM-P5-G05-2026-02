import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { AuthRequest } from '../auth-user';
import { IS_PUBLIC } from '../public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '');
    if (!match) throw new UnauthorizedException();

    let claims: unknown;
    try {
      claims = await this.jwt.verifyAsync(match[1], {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        issuer: 'sgei-api',
        audience: 'sgei-api',
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (!this.isClaims(claims)) throw new UnauthorizedException();

    const session = await this.prisma.sessao.findFirst({
      where: {
        id: claims.sid,
        usuarioId: claims.sub,
        revogadaEm: null,
        expiraEm: { gt: new Date() },
      },
      select: {
        id: true,
        instituicaoId: true,
        usuario: {
          select: {
            id: true,
            perfil: true,
            ativo: true,
            instituicao: { select: { ativa: true } },
          },
        },
      },
    });
    if (!session?.usuario.ativo || !session.usuario.instituicao.ativa) {
      throw new UnauthorizedException();
    }
    request.currentUser = {
      id: session.usuario.id,
      instituicaoId: session.instituicaoId,
      perfil: session.usuario.perfil,
      sessaoId: session.id,
    };
    return true;
  }

  private isClaims(value: unknown): value is { sub: string; sid: string } {
    if (typeof value !== 'object' || value === null) return false;
    const claims = value as Record<string, unknown>;
    return isUUID(claims.sub) && isUUID(claims.sid);
  }
}
