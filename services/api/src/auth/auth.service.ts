import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { FATEC_CODES } from '../fatecs';

const REFRESH_LIFETIME_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }

  listInstituicoes() {
    return this.prisma.instituicao.findMany({
      where: { ativa: true, codigoCps: { in: [...FATEC_CODES] } },
      select: { id: true, nome: true, codigoCps: true },
      orderBy: { codigoCps: 'asc' },
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.usuario.findUnique({
      where: {
        instituicaoId_email: {
          instituicaoId: dto.instituicaoId,
          email: dto.email.trim().toLowerCase(),
        },
      },
      include: { instituicao: { select: { ativa: true } } },
    });
    if (
      !user?.ativo ||
      !user.instituicao.ativa ||
      !(await argon2.verify(user.senhaHash, dto.senha))
    ) {
      this.logger.warn('login_failed');
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const refreshToken = this.newRefreshToken();
    const sessionId = await this.prisma.$transaction((tx) =>
      this.createSession(tx, user, refreshToken, 'LOGIN'),
    );
    return this.tokenResponse(user.id, sessionId, refreshToken);
  }

  async refresh(dto: RefreshDto) {
    const session = await this.prisma.sessao.findUnique({
      where: { tokenHash: this.hashToken(dto.refreshToken) },
      include: {
        usuario: { include: { instituicao: { select: { ativa: true } } } },
      },
    });
    if (
      !session ||
      session.revogadaEm ||
      session.expiraEm <= new Date() ||
      !session.usuario.ativo ||
      !session.usuario.instituicao.ativa
    ) {
      throw new UnauthorizedException();
    }

    const nextRefreshToken = this.newRefreshToken();
    const nextSessionId = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.sessao.updateMany({
        where: {
          id: session.id,
          revogadaEm: null,
          expiraEm: { gt: new Date() },
        },
        data: { revogadaEm: new Date() },
      });
      if (revoked.count !== 1) throw new UnauthorizedException();
      return this.createSession(
        tx,
        { id: session.usuarioId, instituicaoId: session.instituicaoId },
        nextRefreshToken,
        'REFRESH',
      );
    });
    return this.tokenResponse(
      session.usuarioId,
      nextSessionId,
      nextRefreshToken,
    );
  }

  async logout(dto: RefreshDto): Promise<void> {
    const tokenHash = this.hashToken(dto.refreshToken);
    const session = await this.prisma.sessao.findUnique({
      where: { tokenHash },
    });
    if (!session) return;
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.sessao.updateMany({
        where: { id: session.id, revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
      if (revoked.count === 1) {
        await tx.auditoria.create({
          data: {
            instituicaoId: session.instituicaoId,
            autorId: session.usuarioId,
            acao: 'LOGOUT',
            recurso: 'SESSAO',
            recursoId: session.id,
          },
        });
      }
    });
  }

  private newRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private expirationDate() {
    return new Date(Date.now() + REFRESH_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  }

  private signAccessToken(userId: string, sessionId: string) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
        issuer: 'sgei-api',
        audience: 'sgei-api',
      },
    );
  }

  private async createSession(
    tx: Prisma.TransactionClient,
    user: { id: string; instituicaoId: string },
    refreshToken: string,
    action: 'LOGIN' | 'REFRESH',
  ): Promise<string> {
    const session = await tx.sessao.create({
      data: {
        instituicaoId: user.instituicaoId,
        usuarioId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiraEm: this.expirationDate(),
      },
    });
    await tx.auditoria.create({
      data: {
        instituicaoId: user.instituicaoId,
        autorId: user.id,
        acao: action,
        recurso: 'SESSAO',
        recursoId: session.id,
      },
    });
    return session.id;
  }

  private async tokenResponse(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ) {
    return {
      accessToken: await this.signAccessToken(userId, sessionId),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }
}
