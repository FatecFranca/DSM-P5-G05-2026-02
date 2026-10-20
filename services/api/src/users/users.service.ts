import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const safeUser = {
  id: true,
  instituicaoId: true,
  email: true,
  nome: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(instituicaoId: string) {
    return this.prisma.usuario.findMany({
      where: { instituicaoId },
      select: safeUser,
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
  }

  async findOne(instituicaoId: string, id: string) {
    const user = await this.prisma.usuario.findFirst({
      where: { id, instituicaoId },
      select: safeUser,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const nome = dto.nome.trim();
    if (nome.length < 2) {
      throw new BadRequestException('Nome deve ter pelo menos 2 caracteres');
    }
    const senhaHash = await argon2.hash(dto.senha, { type: argon2.argon2id });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.usuario.create({
          data: {
            instituicaoId: actor.instituicaoId,
            email,
            nome,
            senhaHash,
            perfil: dto.perfil,
          },
          select: safeUser,
        });
        await tx.auditoria.create({
          data: {
            instituicaoId: actor.instituicaoId,
            autorId: actor.id,
            acao: 'CREATE',
            recurso: 'USUARIO',
            recursoId: created.id,
          },
        });
        return created;
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail já cadastrado nesta instituição');
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
