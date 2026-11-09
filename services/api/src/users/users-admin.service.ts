import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthUser } from '../auth/auth-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ImportQuery, UpdateUserDto } from './dto/update-user.dto';
import {
  classKey,
  createPeopleTemplate,
  normalizeText,
  parsePeopleWorkbook,
  type ImportProfile,
} from './people-import';
import { generateTempPassword } from './temp-password';

// Gestão do ciclo de vida das contas: editar, desativar/reativar, redefinir senha e cadastrar em lote.
//  - Coordenação administra qualquer pessoa da instituição; secretaria, apenas estudantes.
//  - Ninguém administra a própria conta por aqui (a senha própria se troca em /auth/trocar-senha).
//  - Desativar e redefinir senha revogam as sessões: o efeito é imediato, pois o acesso confere a sessão
//    em toda requisição.

const publicUser = {
  id: true,
  instituicaoId: true,
  email: true,
  nome: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
} as const;

const MAX_REPORTED_ERRORS = 30;

async function hashAll(passwords: string[]) {
  const hashes: string[] = [];
  // Em lotes: o argon2 usa o pool de threads, e um lote por vez mantém o servidor responsivo.
  for (let start = 0; start < passwords.length; start += 8) {
    hashes.push(
      ...(await Promise.all(
        passwords
          .slice(start, start + 8)
          .map((password) => argon2.hash(password, { type: argon2.argon2id })),
      )),
    );
  }
  return hashes;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class UsersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private requireManager(actor: AuthUser) {
    if (actor.perfil !== 'COORDENACAO' && actor.perfil !== 'SECRETARIA') {
      throw new ForbiddenException();
    }
  }

  /** Pessoa que o ator pode administrar; 404 para o resto (não revela se existe). */
  private async managed(actor: AuthUser, id: string) {
    this.requireManager(actor);
    const user = await this.prisma.usuario.findFirst({
      where: {
        id,
        instituicaoId: actor.instituicaoId,
        ...(actor.perfil === 'SECRETARIA' ? { perfil: 'ALUNO' as const } : {}),
      },
      select: { id: true, perfil: true, ativo: true, nome: true, email: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    acao: string,
    recursoId: string,
  ) {
    return tx.auditoria.create({
      data: {
        instituicaoId: actor.instituicaoId,
        autorId: actor.id,
        acao,
        recurso: 'USUARIO',
        recursoId,
      },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const target = await this.managed(actor, id);
    if (
      dto.nome === undefined &&
      dto.email === undefined &&
      dto.ativo === undefined
    ) {
      throw new BadRequestException('Informe o que deve ser alterado');
    }
    const data: Prisma.UsuarioUpdateInput = {};
    const identityChanged =
      (dto.nome !== undefined && dto.nome !== target.nome) ||
      (dto.email !== undefined && dto.email.toLowerCase() !== target.email);
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    const activeChanged = dto.ativo !== undefined && dto.ativo !== target.ativo;
    if (activeChanged) {
      if (!dto.ativo) {
        if (target.id === actor.id) {
          throw new BadRequestException(
            'Você não pode desativar a própria conta',
          );
        }
        if (target.perfil === 'COORDENACAO') {
          const others = await this.prisma.usuario.count({
            where: {
              instituicaoId: actor.instituicaoId,
              perfil: 'COORDENACAO',
              ativo: true,
              id: { not: target.id },
            },
          });
          if (!others) {
            throw new ConflictException(
              'A instituição precisa manter ao menos uma coordenação ativa',
            );
          }
        }
      }
      data.ativo = dto.ativo;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.usuario.update({
          where: {
            instituicaoId_id: { instituicaoId: actor.instituicaoId, id },
          },
          data,
          select: publicUser,
        });
        if (activeChanged && !dto.ativo) {
          await tx.sessao.updateMany({
            where: { usuarioId: id, revogadaEm: null },
            data: { revogadaEm: new Date() },
          });
        }
        if (identityChanged)
          await this.audit(tx, actor, 'ATUALIZAR_USUARIO', id);
        if (activeChanged) {
          await this.audit(
            tx,
            actor,
            dto.ativo ? 'REATIVAR_USUARIO' : 'DESATIVAR_USUARIO',
            id,
          );
        }
        return updated;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('E-mail já cadastrado nesta instituição');
      }
      throw error;
    }
  }

  /** Gera uma senha temporária única, exige a troca no próximo acesso e derruba as sessões abertas. */
  async resetPassword(actor: AuthUser, id: string) {
    const target = await this.managed(actor, id);
    if (target.id === actor.id) {
      throw new BadRequestException(
        'Use a troca de senha da sua conta para alterar a própria senha',
      );
    }
    if (!target.ativo) {
      throw new ConflictException('Reative a conta antes de redefinir a senha');
    }
    const senhaTemporaria = generateTempPassword();
    const senhaHash = await argon2.hash(senhaTemporaria, {
      type: argon2.argon2id,
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { instituicaoId_id: { instituicaoId: actor.instituicaoId, id } },
        data: { senhaHash, trocaSenhaObrigatoria: true },
      });
      await tx.sessao.updateMany({
        where: { usuarioId: id, revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
      await this.audit(tx, actor, 'REDEFINIR_SENHA', id);
    });
    return {
      id: target.id,
      nome: target.nome,
      email: target.email,
      senhaTemporaria,
    };
  }

  // -------------------------------------------------------------------- cadastro em lote

  template(actor: AuthUser, perfil: ImportProfile) {
    this.requireImport(actor, perfil);
    return createPeopleTemplate(perfil);
  }

  private requireImport(actor: AuthUser, perfil: ImportProfile) {
    this.requireManager(actor);
    if (actor.perfil === 'SECRETARIA' && perfil !== 'ALUNO') {
      throw new ForbiddenException('Secretaria cadastra apenas estudantes');
    }
  }

  /**
   * Valida a planilha inteira antes de gravar: com qualquer problema nada é importado e cada linha com
   * erro é listada. `simular` devolve só a contagem. Contas novas recebem senha temporária própria,
   * devolvida UMA vez na resposta (não fica guardada em texto).
   */
  async importPeople(actor: AuthUser, buffer: Buffer, query: ImportQuery) {
    const perfil = query.perfil;
    this.requireImport(actor, perfil);
    const { rows, errors } = await parsePeopleWorkbook(buffer, perfil);
    const tenant = actor.instituicaoId;

    const emails = [...new Set(rows.map((row) => row.email))];
    const existingUsers = emails.length
      ? await this.prisma.usuario.findMany({
          where: {
            instituicaoId: tenant,
            OR: emails.map((email) => ({
              email: { equals: email, mode: 'insensitive' as const },
            })),
          },
          select: {
            id: true,
            email: true,
            nome: true,
            perfil: true,
            ativo: true,
          },
        })
      : [];
    const userByEmail = new Map(
      existingUsers.map((user) => [user.email.toLowerCase(), user]),
    );

    const classKeys = new Map<string, (typeof rows)[number]['turma']>();
    for (const row of rows) {
      if (row.turma) classKeys.set(classKey(row.turma), row.turma);
    }
    const classes = classKeys.size
      ? await this.prisma.turma.findMany({
          where: {
            instituicaoId: tenant,
            OR: [...classKeys.values()].map((turma) => ({
              nome: turma!.nome,
              curso: turma!.curso,
              periodo: turma!.periodo,
            })),
          },
          select: {
            id: true,
            nome: true,
            curso: true,
            periodo: true,
            fechada: true,
          },
        })
      : [];
    const classByKey = new Map(
      classes.map((turma) => [classKey(turma), turma]),
    );

    const registros = rows.flatMap((row) =>
      row.registro ? [row.registro] : [],
    );
    const enrollments = registros.length
      ? await this.prisma.matricula.findMany({
          where: {
            instituicaoId: tenant,
            OR: [
              { registro: { in: registros } },
              {
                alunoId: { in: existingUsers.map((user) => user.id) },
                turmaId: { in: classes.map((turma) => turma.id) },
              },
            ],
          },
          select: { registro: true, alunoId: true, turmaId: true },
        })
      : [];
    const enrollmentByRegistro = new Map(
      enrollments.map((item) => [item.registro, item]),
    );
    const enrolledIn = new Set(
      enrollments.map((item) => `${item.alunoId}:${item.turmaId}`),
    );

    const problems = [...errors];
    const newUsers = new Map<string, { nome: string; linha: number }>();
    const newEnrollments: {
      linha: number;
      email: string;
      turmaId: string;
      registro: string;
    }[] = [];
    let existingPeople = 0;
    let existingEnrollments = 0;
    const countedExisting = new Set<string>();
    for (const row of rows) {
      const found = userByEmail.get(row.email);
      if (found) {
        if (found.perfil !== perfil) {
          problems.push(
            `Linha ${row.linha}: este e-mail já pertence a outro perfil`,
          );
          continue;
        }
        if (normalizeText(found.nome) !== normalizeText(row.nome)) {
          problems.push(
            `Linha ${row.linha}: e-mail já cadastrado com outro nome (${found.nome})`,
          );
          continue;
        }
        if (!found.ativo) {
          problems.push(
            `Linha ${row.linha}: cadastro inativo; reative a conta antes de importar`,
          );
          continue;
        }
        if (!countedExisting.has(row.email)) {
          countedExisting.add(row.email);
          existingPeople++;
        }
      } else if (!newUsers.has(row.email)) {
        newUsers.set(row.email, { nome: row.nome, linha: row.linha });
      }
      if (!row.turma || !row.registro) continue;
      const turma = classByKey.get(classKey(row.turma));
      if (!turma) {
        problems.push(
          `Linha ${row.linha}: turma "${row.turma.nome}" (${row.turma.curso}, ${row.turma.periodo}) não existe nesta instituição`,
        );
        continue;
      }
      if (turma.fechada) {
        problems.push(
          `Linha ${row.linha}: a turma "${turma.nome}" está fechada`,
        );
        continue;
      }
      const sameRegistro = enrollmentByRegistro.get(row.registro);
      if (sameRegistro) {
        if (
          found &&
          sameRegistro.alunoId === found.id &&
          sameRegistro.turmaId === turma.id
        ) {
          existingEnrollments++;
        } else {
          problems.push(
            `Linha ${row.linha}: o registro ${row.registro} já pertence a outro aluno ou turma`,
          );
        }
        continue;
      }
      if (found && enrolledIn.has(`${found.id}:${turma.id}`)) {
        problems.push(
          `Linha ${row.linha}: esta pessoa já está matriculada em "${turma.nome}" com outro registro`,
        );
        continue;
      }
      newEnrollments.push({
        linha: row.linha,
        email: row.email,
        turmaId: turma.id,
        registro: row.registro,
      });
    }
    if (problems.length) {
      // Na ordem da planilha: erros de leitura e de cadastro chegam separados, mas quem corrige lê de cima para baixo.
      const lineOf = (text: string) =>
        Number(/^Linha (\d+)/.exec(text)?.[1] ?? 0);
      problems.sort((a, b) => lineOf(a) - lineOf(b));
      const shown = problems.slice(0, MAX_REPORTED_ERRORS);
      const more = problems.length - shown.length;
      throw new BadRequestException([
        `A planilha tem ${problems.length} problema(s). Nada foi importado.`,
        ...shown,
        ...(more > 0 ? [`... e mais ${more}.`] : []),
      ]);
    }

    const resumo = {
      linhas: rows.length,
      usuariosNovos: newUsers.size,
      usuariosExistentes: existingPeople,
      matriculasNovas: newEnrollments.length,
      matriculasExistentes: existingEnrollments,
    };
    if (query.simular) return { simulacao: true, resumo, credenciais: [] };

    const created = [...newUsers.entries()].map(([email, info]) => ({
      email,
      ...info,
      senha: generateTempPassword(),
    }));
    const hashes = await hashAll(created.map((item) => item.senha));
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const idByEmail = new Map(
            existingUsers.map((user) => [user.email.toLowerCase(), user.id]),
          );
          for (const [index, item] of created.entries()) {
            const user = await tx.usuario.create({
              data: {
                instituicaoId: tenant,
                email: item.email,
                nome: item.nome,
                perfil,
                senhaHash: hashes[index],
                trocaSenhaObrigatoria: true,
              },
              select: { id: true },
            });
            idByEmail.set(item.email, user.id);
          }
          if (created.length) {
            await tx.auditoria.createMany({
              data: created.map((item) => ({
                instituicaoId: tenant,
                autorId: actor.id,
                acao: 'IMPORTAR_USUARIO',
                recurso: 'USUARIO',
                recursoId: idByEmail.get(item.email)!,
              })),
            });
          }
          for (const item of newEnrollments) {
            const enrollment = await tx.matricula.create({
              data: {
                instituicaoId: tenant,
                turmaId: item.turmaId,
                alunoId: idByEmail.get(item.email)!,
                registro: item.registro,
              },
              select: { id: true },
            });
            await tx.auditoria.create({
              data: {
                instituicaoId: tenant,
                autorId: actor.id,
                acao: 'MATRICULAR_ALUNO',
                recurso: 'MATRICULA',
                recursoId: enrollment.id,
              },
            });
          }
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Algum cadastro foi criado enquanto a planilha era processada. Envie novamente.',
        );
      }
      throw error;
    }
    const registroByEmail = new Map(
      newEnrollments.map((item) => [item.email, item.registro]),
    );
    return {
      simulacao: false,
      resumo,
      credenciais: created.map((item) => ({
        linha: item.linha,
        nome: item.nome,
        email: item.email,
        registro: registroByEmail.get(item.email) ?? null,
        senhaTemporaria: item.senha,
      })),
    };
  }
}
