import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth-user';
import { requireRole } from '../../academic/academic.policy';
import { applySourceFeatures } from '../feature-source-sync';
import type { IngressDeclarationDto } from '../dto/ingress-declaration.dto';
import {
  INGRESS_FEATURES,
  type IngressSourceDto,
} from '../dto/ingress-source.dto';

@Injectable()
export class IngressService {
  constructor(private readonly db: PrismaService) {}

  async searchEnrollments(actor: AuthUser, registro: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    const term = registro.trim();
    if (term.length < 2)
      throw new BadRequestException(
        'Informe ao menos 2 caracteres do registro',
      );
    return this.db.matricula.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        registro: { startsWith: term, mode: 'insensitive' },
      },
      select: { id: true, registro: true, aluno: { select: { nome: true } } },
      orderBy: { registro: 'asc' },
      take: 20,
    });
  }

  async pending(actor: AuthUser) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    return this.db.declaracaoIngressoMl.findMany({
      where: { instituicaoId: actor.instituicaoId, pendente: true },
      select: {
        matriculaId: true,
        revisao: true,
        atualizadoEm: true,
        matricula: {
          select: { registro: true, aluno: { select: { nome: true } } },
        },
      },
      orderBy: { atualizadoEm: 'asc' },
      take: 50,
    });
  }

  private async enrollment(
    actor: AuthUser,
    id: string,
    role: 'ALUNO' | 'COORDENACAO' | 'SECRETARIA',
  ) {
    requireRole(actor, [role]);
    const item = await this.db.matricula.findFirst({
      where: {
        id,
        instituicaoId: actor.instituicaoId,
        ...(role === 'ALUNO' ? { alunoId: actor.id } : {}),
      },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Matrícula não encontrada');
  }

  async declaration(actor: AuthUser, id: string) {
    await this.enrollment(actor, id, 'ALUNO');
    const item = await this.db.declaracaoIngressoMl.findUnique({
      where: { matriculaId: id },
      select: {
        dados: true,
        revisao: true,
        pendente: true,
        atualizadoEm: true,
      },
    });
    return item ?? { dados: {}, revisao: 0, pendente: false };
  }

  async saveDeclaration(
    actor: AuthUser,
    id: string,
    dto: IngressDeclarationDto,
  ) {
    await this.enrollment(actor, id, 'ALUNO');
    const dados = Object.fromEntries(
      Object.entries(dto.dados).filter(([, value]) => value !== undefined),
    );
    const pendente = Object.keys(dados).length > 0;
    try {
      await this.db.$transaction(
        async (tx) => {
          const current = await tx.declaracaoIngressoMl.findUnique({
            where: { matriculaId: id },
          });
          if ((current?.revisao ?? 0) !== dto.versao)
            throw new ConflictException('Declaração alterada. Recarregue.');
          if (
            current &&
            JSON.stringify(current.dados) === JSON.stringify(dados)
          )
            return;
          if (!current) {
            await tx.declaracaoIngressoMl.create({
              data: {
                instituicaoId: actor.instituicaoId,
                matriculaId: id,
                dados,
                pendente,
              },
            });
          } else {
            const updated = await tx.declaracaoIngressoMl.updateMany({
              where: {
                matriculaId: id,
                instituicaoId: actor.instituicaoId,
                revisao: dto.versao,
              },
              data: { dados, revisao: { increment: 1 }, pendente },
            });
            if (updated.count !== 1)
              throw new ConflictException('Declaração alterada. Recarregue.');
          }
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'DECLARAR_DADOS_INGRESSO',
              recurso: 'MATRICULA',
              recursoId: id,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException('Declaração alterada por outra sessão');
      throw error;
    }
    return this.declaration(actor, id);
  }

  async source(actor: AuthUser, id: string) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    await this.enrollment(
      actor,
      id,
      actor.perfil as 'COORDENACAO' | 'SECRETARIA',
    );
    const [official, declaration] = await this.db.$transaction([
      this.db.fonteIngressoMl.findUnique({ where: { matriculaId: id } }),
      this.db.declaracaoIngressoMl.findUnique({ where: { matriculaId: id } }),
    ]);
    return { official, declaration };
  }

  async saveSource(actor: AuthUser, id: string, dto: IngressSourceDto) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    await this.enrollment(
      actor,
      id,
      actor.perfil as 'COORDENACAO' | 'SECRETARIA',
    );
    const features = Object.fromEntries(Object.entries(dto.features)) as Record<
      string,
      number
    >;
    const patch: Record<string, number | undefined> = Object.fromEntries(
      INGRESS_FEATURES.map((name) => [name, features[name]]),
    );
    try {
      await this.db.$transaction(
        async (tx) => {
          const current = await tx.fonteIngressoMl.findUnique({
            where: { matriculaId: id },
          });
          if ((current?.revisao ?? 0) !== dto.versao)
            throw new ConflictException('Fonte alterada. Recarregue.');
          const data = { features, fonteRef: dto.fonteRef.trim() };
          if (!current) {
            await tx.fonteIngressoMl.create({
              data: {
                matriculaId: id,
                instituicaoId: actor.instituicaoId,
                ...data,
              },
            });
          } else {
            const updated = await tx.fonteIngressoMl.updateMany({
              where: {
                matriculaId: id,
                instituicaoId: actor.instituicaoId,
                revisao: dto.versao,
              },
              data: { ...data, revisao: { increment: 1 } },
            });
            if (updated.count !== 1)
              throw new ConflictException('Fonte alterada. Recarregue.');
          }
          await applySourceFeatures(tx, {
            instituicaoId: actor.instituicaoId,
            matriculaId: id,
            patch,
            origem: 'INGRESSO_OFICIAL',
            autorId: actor.id,
          });
          await tx.declaracaoIngressoMl.updateMany({
            where: {
              matriculaId: id,
              instituicaoId: actor.instituicaoId,
              pendente: true,
            },
            data: { pendente: false },
          });
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'HOMOLOGAR_DADOS_INGRESSO',
              recurso: 'MATRICULA',
              recursoId: id,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException('Fonte alterada por outra sessão');
      throw error;
    }
    return this.source(actor, id);
  }
}
