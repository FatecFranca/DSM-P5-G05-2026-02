import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth-user';
import { MlClientService } from '../ml-client.service';
import { EnrollmentMlService } from '../enrollment-ml.service';
import { type MlFeatures } from '../ml.types';
import { ML_FEATURES } from '../ml.types';
import { parseImportWorkbook } from './workbook-parser';
import { requireRole } from '../../academic/academic.policy';
import { ACTIVE_MODEL_VERSION } from '../model-version';

@Injectable()
export class ImportsService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly ml: MlClientService,
    private readonly profiles: EnrollmentMlService,
  ) {}

  async import(actor: AuthUser, buffer: Buffer) {
    requireRole(actor, ['COORDENACAO']);
    const rows = await parseImportWorkbook(buffer);
    if (this.config.get<string>('ML_PREVIEW_ENABLED') !== 'true') {
      throw new ServiceUnavailableException(
        'Prévia técnica de ML desabilitada',
      );
    }
    const status = await this.ml.status();
    if (
      !status.ready ||
      !status.originalInputReady ||
      status.modelVersion !== ACTIVE_MODEL_VERSION
    ) {
      throw new ServiceUnavailableException(
        'O modelo .pkl ativo não está pronto para importação',
      );
    }
    const modelVersion = status.modelVersion;
    const arquivoSha256 = createHash('sha256').update(buffer).digest('hex');
    const enrolled = await this.db.matricula.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        registro: { in: rows.map((row) => row.registro) },
      },
      select: {
        id: true,
        registro: true,
        turmaId: true,
        aluno: { select: { id: true, nome: true, email: true, perfil: true } },
        perfilMl: { select: { versao: true, features: true } },
      },
    });
    const byRegistro = new Map(enrolled.map((item) => [item.registro, item]));
    const academic = new Map<string, { turmaId: string; alunoId?: string }>();
    const usedEmails = new Map<string, string>();
    const usedEmailClasses = new Set<string>();
    for (const row of rows) {
      const previousName = usedEmails.get(row.alunoEmail);
      if (previousName && previousName !== row.alunoNome)
        throw new BadRequestException(
          `Linha ${row.linha}: nomes diferentes para o mesmo e-mail`,
        );
      usedEmails.set(row.alunoEmail, row.alunoNome);
      const turma = await this.db.turma.findFirst({
        where: {
          instituicaoId: actor.instituicaoId,
          nome: row.turmaNome,
          curso: row.turmaCurso,
          periodo: row.turmaPeriodo,
          fechada: false,
        },
        select: { id: true },
      });
      if (!turma)
        throw new BadRequestException(
          `Linha ${row.linha}: turma e período inexistentes ou fechados`,
        );
      const classKey = `${row.alunoEmail}:${turma.id}`;
      if (usedEmailClasses.has(classKey))
        throw new BadRequestException(
          `Linha ${row.linha}: aluno duplicado na mesma turma`,
        );
      usedEmailClasses.add(classKey);
      const disciplina = await this.db.disciplina.findFirst({
        where: {
          instituicaoId: actor.instituicaoId,
          turmaId: turma.id,
          nome: row.disciplinaNome,
        },
        select: { id: true },
      });
      if (!disciplina)
        throw new BadRequestException(
          `Linha ${row.linha}: disciplina inexistente na turma`,
        );
      const professor = await this.db.usuario.findUnique({
        where: {
          instituicaoId_email: {
            instituicaoId: actor.instituicaoId,
            email: row.professorEmail,
          },
        },
        select: { id: true, perfil: true, ativo: true },
      });
      if (!professor?.ativo || professor.perfil !== 'PROFESSOR')
        throw new BadRequestException(
          `Linha ${row.linha}: professor inexistente ou inativo`,
        );
      const lotacao = await this.db.lotacao.findUnique({
        where: {
          instituicaoId_disciplinaId_professorId: {
            instituicaoId: actor.instituicaoId,
            disciplinaId: disciplina.id,
            professorId: professor.id,
          },
        },
        select: { professorId: true },
      });
      if (!lotacao)
        throw new BadRequestException(
          `Linha ${row.linha}: professor não lotado na disciplina`,
        );
      const user = await this.db.usuario.findUnique({
        where: {
          instituicaoId_email: {
            instituicaoId: actor.instituicaoId,
            email: row.alunoEmail,
          },
        },
        select: { id: true, nome: true, perfil: true, ativo: true },
      });
      if (
        user &&
        (!user.ativo || user.perfil !== 'ALUNO' || user.nome !== row.alunoNome)
      )
        throw new BadRequestException(
          `Linha ${row.linha}: cadastro do aluno incompatível`,
        );
      const current = byRegistro.get(row.registro);
      if (
        current &&
        (current.turmaId !== turma.id ||
          current.aluno.email !== row.alunoEmail ||
          current.aluno.nome !== row.alunoNome)
      )
        throw new ConflictException(
          `Linha ${row.linha}: matrícula existente pertence a outro aluno ou turma`,
        );
      if (!current && user) {
        const other = await this.db.matricula.findFirst({
          where: {
            instituicaoId: actor.instituicaoId,
            turmaId: turma.id,
            alunoId: user.id,
          },
          select: { registro: true },
        });
        if (other)
          throw new ConflictException(
            `Linha ${row.linha}: aluno já matriculado na turma com registro ${other.registro}`,
          );
      }
      academic.set(row.registro, { turmaId: turma.id, alunoId: user?.id });
    }
    const previous = await this.db.previsaoImportadaMl.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        arquivoSha256,
        modelVersion,
        matriculaId: { in: enrolled.map((item) => item.id) },
      },
    });
    const byMatricula = new Map(
      previous.map((item) => [item.matriculaId, item]),
    );
    const pending = rows.filter((row) => {
      const student = byRegistro.get(row.registro);
      const prior = student ? byMatricula.get(student.id) : undefined;
      return !(
        prior &&
        prior.perfilVersao === student?.perfilMl?.versao &&
        ML_FEATURES.every(
          (name) =>
            (prior.features as Record<string, number>)[name] ===
            row.features[name],
        )
      );
    });
    for (const row of pending) {
      const current = byRegistro.get(row.registro)?.perfilMl?.versao ?? 0;
      const savedFeatures = byRegistro.get(row.registro)?.perfilMl?.features as
        Record<string, number> | undefined;
      const canRecover =
        current === row.versaoPerfil + 1 &&
        savedFeatures &&
        ML_FEATURES.every((name) => savedFeatures[name] === row.features[name]);
      if (row.versaoPerfil !== current && !canRecover) {
        throw new ConflictException(
          `Linha ${row.linha}: perfil alterado. Informe versaoPerfil=${current}`,
        );
      }
    }
    if (!pending.length)
      return {
        modelVersion,
        arquivoSha256,
        total: rows.length,
        salvos: 0,
        usuariosCriados: 0,
        matriculasCriadas: 0,
        repetidos: rows.length,
        erros: [],
        status: 'EXPERIMENTAL' as const,
      };
    const items = pending.map((row) => ({
      ref: randomUUID(),
      features: row.features,
    }));
    const prediction = await this.ml.predictBatch({
      model_version: modelVersion,
      input_format: 'original',
      request_id: randomUUID(),
      items,
    });
    const byRef = new Map(prediction.results.map((item) => [item.ref, item]));
    const erros: Array<{ linha: number; registro: string; motivo: string }> =
      [];
    let salvos = 0;
    let usuariosCriados = 0;
    let matriculasCriadas = 0;
    const createdByEmail = new Map<string, string>();
    for (let index = 0; index < pending.length; index++) {
      const row = pending[index];
      const result = byRef.get(items[index].ref)!;
      let newEnrollmentId: string | undefined;
      let newUserId: string | undefined;
      try {
        let student = byRegistro.get(row.registro);
        if (!student) {
          const link = academic.get(row.registro)!;
          const knownStudentId =
            link.alunoId ?? createdByEmail.get(row.alunoEmail);
          const passwordHash = knownStudentId
            ? undefined
            : await argon2.hash('Fatec@123', { type: argon2.argon2id });
          const created = await this.db.$transaction(async (tx) => {
            let alunoId = knownStudentId;
            if (!alunoId) {
              const user = await tx.usuario.create({
                data: {
                  instituicaoId: actor.instituicaoId,
                  email: row.alunoEmail,
                  nome: row.alunoNome,
                  perfil: 'ALUNO',
                  senhaHash: passwordHash!,
                  trocaSenhaObrigatoria: true,
                },
              });
              alunoId = user.id;
              await tx.auditoria.create({
                data: {
                  instituicaoId: actor.instituicaoId,
                  autorId: actor.id,
                  acao: 'IMPORTAR_ALUNO_ML',
                  recurso: 'USUARIO',
                  recursoId: user.id,
                },
              });
            }
            const enrollment = await tx.matricula.create({
              data: {
                instituicaoId: actor.instituicaoId,
                turmaId: link.turmaId,
                alunoId,
                registro: row.registro,
              },
            });
            await tx.auditoria.create({
              data: {
                instituicaoId: actor.instituicaoId,
                autorId: actor.id,
                acao: 'MATRICULAR_ALUNO',
                recurso: 'MATRICULA',
                recursoId: enrollment.id,
              },
            });
            return enrollment;
          });
          if (!knownStudentId) {
            usuariosCriados++;
            createdByEmail.set(row.alunoEmail, created.alunoId);
            newUserId = created.alunoId;
          }
          matriculasCriadas++;
          newEnrollmentId = created.id;
          student = {
            id: created.id,
            registro: row.registro,
            turmaId: link.turmaId,
            aluno: {
              id: created.alunoId,
              nome: row.alunoNome,
              email: row.alunoEmail,
              perfil: 'ALUNO' as const,
            },
            perfilMl: null,
          };
          byRegistro.set(row.registro, student);
        }
        const currentProfile = student.perfilMl;
        const canRecover =
          currentProfile?.versao === row.versaoPerfil + 1 &&
          ML_FEATURES.every(
            (name) =>
              (currentProfile.features as Record<string, number>)[name] ===
              row.features[name],
          );
        const saved = canRecover
          ? await this.profiles.get(actor, student.id)
          : await this.profiles.save(actor, student.id, {
              versao: row.versaoPerfil,
              features: row.features,
            });
        if (
          saved.versao !== row.versaoPerfil + 1 ||
          saved.faltantes.length ||
          !saved.features ||
          ML_FEATURES.some(
            (name) => saved.features?.[name] !== row.features[name],
          )
        ) {
          throw new ConflictException('Perfil alterado durante a importação');
        }
        await this.db.$transaction(async (tx) => {
          await tx.previsaoImportadaMl.upsert({
            where: {
              instituicaoId_matriculaId_arquivoSha256_modelVersion: {
                instituicaoId: actor.instituicaoId,
                matriculaId: student.id,
                arquivoSha256,
                modelVersion,
              },
            },
            create: {
              instituicaoId: actor.instituicaoId,
              matriculaId: student.id,
              arquivoSha256,
              linha: row.linha,
              modelVersion,
              perfilVersao: saved.versao,
              features: saved.features as MlFeatures,
              predictedClass: result.predicted_class,
              probabilities: result.probabilities,
              autorId: actor.id,
            },
            update: {
              linha: row.linha,
              perfilVersao: saved.versao,
              features: saved.features as MlFeatures,
              predictedClass: result.predicted_class,
              probabilities: result.probabilities,
              autorId: actor.id,
              calculadoEm: new Date(),
            },
          });
          await tx.auditoria.create({
            data: {
              instituicaoId: actor.instituicaoId,
              autorId: actor.id,
              acao: 'IMPORTAR_PREVISAO_ML_EXPERIMENTAL',
              recurso: 'MATRICULA',
              recursoId: student.id,
            },
          });
        });
        salvos++;
      } catch (error) {
        let cleanupError = false;
        if (newEnrollmentId) {
          const enrollmentId = newEnrollmentId;
          try {
            await this.db.$transaction(async (tx) => {
              await tx.matricula.delete({ where: { id: enrollmentId } });
              if (newUserId)
                await tx.usuario.delete({ where: { id: newUserId } });
              await tx.auditoria.deleteMany({
                where: {
                  instituicaoId: actor.instituicaoId,
                  autorId: actor.id,
                  recursoId: {
                    in: [enrollmentId, ...(newUserId ? [newUserId] : [])],
                  },
                  acao: { in: ['MATRICULAR_ALUNO', 'IMPORTAR_ALUNO_ML'] },
                },
              });
            });
            matriculasCriadas--;
            if (newUserId) {
              usuariosCriados--;
              createdByEmail.delete(row.alunoEmail);
            }
            byRegistro.delete(row.registro);
          } catch {
            cleanupError = true;
          }
        }
        erros.push({
          linha: row.linha,
          registro: row.registro,
          motivo: `${error instanceof Error ? error.message : 'Erro ao salvar a linha'}${cleanupError ? '; cadastro parcial exige revisão' : ''}`,
        });
      }
    }
    return {
      modelVersion,
      arquivoSha256,
      total: rows.length,
      salvos,
      usuariosCriados,
      matriculasCriadas,
      repetidos: rows.length - pending.length,
      erros,
      status: 'EXPERIMENTAL',
    };
  }

  async recent(actor: AuthUser) {
    requireRole(actor, ['COORDENACAO']);
    const items = await this.db.previsaoImportadaMl.findMany({
      where: { instituicaoId: actor.instituicaoId },
      take: 50,
      orderBy: [{ calculadoEm: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        arquivoSha256: true,
        linha: true,
        modelVersion: true,
        perfilVersao: true,
        predictedClass: true,
        probabilities: true,
        calculadoEm: true,
        matricula: {
          select: { registro: true, perfilMl: { select: { versao: true } } },
        },
      },
    });
    return items.map(({ matricula, ...item }) => ({
      ...item,
      registro: matricula.registro,
      atual: matricula.perfilMl?.versao === item.perfilVersao,
      status: 'EXPERIMENTAL' as const,
    }));
  }
}
