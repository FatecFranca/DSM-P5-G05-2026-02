import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthUser } from '../auth/auth-user';
import type { Prisma } from '../generated/prisma/client';
import { FATEC_CODES } from '../fatecs';
import { enrollmentScope } from '../academic/academic.policy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';

const safeUser = {
  id: true,
  instituicaoId: true,
  email: true,
  nome: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
  instituicao: { select: { nome: true, codigoCps: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(actor: AuthUser): Prisma.UsuarioWhereInput {
    if (actor.perfil === 'ADMIN') {
      return {
        OR: [
          { instituicaoId: actor.instituicaoId },
          { instituicao: { ativa: true, codigoCps: { in: [...FATEC_CODES] } } },
        ],
      };
    }
    if (actor.perfil === 'COORDENACAO') {
      return { instituicaoId: actor.instituicaoId };
    }
    if (actor.perfil === 'ALUNO') {
      return { id: actor.id, instituicaoId: actor.instituicaoId };
    }
    return {
      instituicaoId: actor.instituicaoId,
      perfil: 'ALUNO',
      matriculas: { some: enrollmentScope(actor) },
    };
  }

  list(actor: AuthUser, query: ListUsersDto = {}) {
    const busca = query.busca?.trim();
    return this.prisma.usuario.findMany({
      where: {
        AND: [
          this.scope(actor),
          ...(query.instituicaoId
            ? [{ instituicaoId: query.instituicaoId }]
            : []),
          ...(query.perfil ? [{ perfil: query.perfil }] : []),
          ...(busca
            ? [
                {
                  OR: [
                    { nome: { contains: busca, mode: 'insensitive' as const } },
                    {
                      email: { contains: busca, mode: 'insensitive' as const },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      select: safeUser,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const user = await this.prisma.usuario.findFirst({
      where: { AND: [this.scope(actor), { id }] },
      select: {
        ...safeUser,
        matriculas: {
          where:
            actor.perfil === 'ADMIN' || actor.perfil === 'COORDENACAO'
              ? undefined
              : enrollmentScope(actor),
          select: {
            id: true,
            registro: true,
            turma: {
              select: { id: true, nome: true, curso: true, periodo: true },
            },
          },
        },
        lotacoes:
          actor.perfil === 'ADMIN'
            ? {
                select: {
                  disciplina: {
                    select: { nome: true, turma: { select: { nome: true } } },
                  },
                },
              }
            : undefined,
        tutorias:
          actor.perfil === 'ADMIN'
            ? {
                select: {
                  matricula: {
                    select: {
                      registro: true,
                      aluno: { select: { nome: true } },
                    },
                  },
                },
              }
            : undefined,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const instituicaoId = dto.instituicaoId ?? actor.instituicaoId;
    const institution = await this.prisma.instituicao.findFirst({
      where: {
        id: instituicaoId,
        ativa: true,
        OR: [
          { id: actor.instituicaoId },
          { codigoCps: { in: [...FATEC_CODES] } },
        ],
      },
      select: { id: true },
    });
    if (!institution) throw new NotFoundException('Fatec não disponível');
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
            instituicaoId,
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
