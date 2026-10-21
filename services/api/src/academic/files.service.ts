import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  StreamableFile,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { enrollmentScope, requireRole, subjectScope } from './academic.policy';

export interface AcademicUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class FilesService {
  private readonly directory = resolve(process.env.UPLOAD_DIR ?? './uploads');
  constructor(private readonly db: PrismaService) {}
  async upload(actor: AuthUser, file: AcademicUpload) {
    requireRole(actor, ['PROFESSOR', 'ALUNO']);
    const id = randomUUID();
    const nome =
      Array.from(file.originalname, (c) =>
        c.charCodeAt(0) < 32 ||
        c.charCodeAt(0) === 127 ||
        c === '/' ||
        c === '\\'
          ? '_'
          : c,
      )
        .join('')
        .slice(0, 200) || 'documento';
    await mkdir(this.directory, { recursive: true });
    const path = resolve(this.directory, id);
    await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      return await this.db.$transaction(async (tx) => {
        // Serialize quota checks for concurrent uploads by this user.
        await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${actor.id}::uuid AND instituicao_id = ${actor.instituicaoId}::uuid FOR UPDATE`;
        const used = await tx.arquivo.aggregate({
          where: { instituicaoId: actor.instituicaoId, autorId: actor.id },
          _sum: { tamanho: true },
        });
        if ((used._sum.tamanho ?? 0) + file.size > 100 * 1024 * 1024)
          throw new PayloadTooLargeException(
            'Limite de 100 MB por usuário atingido',
          );
        const result = await tx.arquivo.create({
          data: {
            id,
            instituicaoId: actor.instituicaoId,
            autorId: actor.id,
            nome,
            mime: file.mimetype,
            tamanho: file.size,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
          },
          select: { id: true, nome: true, mime: true, tamanho: true },
        });
        await tx.auditoria.create({
          data: {
            instituicaoId: actor.instituicaoId,
            autorId: actor.id,
            acao: 'ENVIAR_ARQUIVO',
            recurso: 'ARQUIVO',
            recursoId: id,
          },
        });
        return result;
      });
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }
  async download(actor: AuthUser, id: string) {
    const file = await this.db.arquivo.findFirst({
      where: {
        id,
        instituicaoId: actor.instituicaoId,
        OR: [
          { autorId: actor.id },
          ...(actor.perfil === 'TUTOR'
            ? []
            : [{ materiais: { some: { disciplina: subjectScope(actor) } } }]),
          {
            entregas: {
              some: {
                matricula: enrollmentScope(actor),
                atividade: {
                  disciplina: subjectScope(actor),
                  ...(actor.perfil === 'ALUNO' || actor.perfil === 'TUTOR'
                    ? { estado: { not: 'RASCUNHO' as const } }
                    : {}),
                },
              },
            },
          },
        ],
      },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    let bytes: Buffer;
    try {
      bytes = await readFile(resolve(this.directory, file.id));
    } catch {
      throw new NotFoundException('Arquivo indisponível');
    }
    return new StreamableFile(bytes, {
      type: file.mime,
      length: file.tamanho,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.nome)}`,
    });
  }
}
