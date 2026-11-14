import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/auth-user';
import { requireRole } from '../../../academic/academic.policy';
import { PrismaService } from '../../../prisma/prisma.service';
import { OfficialSourcesService } from '../official-sources.service';
import { parseMacroWorkbook, parseSemesterWorkbook } from './source-workbook';

@Injectable()
export class SourceWorkbookService {
  constructor(
    private readonly db: PrismaService,
    private readonly sources: OfficialSourcesService,
  ) {}

  async semesters(actor: AuthUser, buffer: Buffer) {
    requireRole(actor, ['COORDENACAO', 'SECRETARIA']);
    const rows = await parseSemesterWorkbook(buffer);
    const enrolled = await this.db.matricula.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        registro: { in: rows.map((row) => row.registro) },
      },
      select: { id: true, registro: true },
    });
    const byRegistration = new Map(
      enrolled.map((item) => [item.registro, item.id]),
    );
    const missing = rows
      .filter((row) => !byRegistration.has(row.registro))
      .map((row) => row.registro);
    if (missing.length)
      throw new BadRequestException(
        `Matrículas não encontradas: ${[...new Set(missing)].join(', ')}`,
      );
    let salvos = 0;
    let repetidos = 0;
    const erros: { linha: number; registro: string; motivo: string }[] = [];
    for (const row of rows) {
      const id = byRegistration.get(row.registro)!;
      try {
        const current = await this.sources.semester(actor, id, row.semestre);
        const same =
          current &&
          (
            [
              'creditadas',
              'matriculadas',
              'avaliacoes',
              'aprovadas',
              'nota',
              'semAvaliacao',
              'fonteRef',
            ] as const
          ).every((name) => current[name] === row[name]);
        if (same) {
          repetidos += 1;
          continue;
        }
        await this.sources.saveSemester(actor, id, row.semestre, {
          versao: current?.revisao ?? 0,
          creditadas: row.creditadas,
          matriculadas: row.matriculadas,
          avaliacoes: row.avaliacoes,
          aprovadas: row.aprovadas,
          nota: row.nota,
          semAvaliacao: row.semAvaliacao,
          fonteRef: row.fonteRef,
        });
        salvos += 1;
      } catch (error) {
        erros.push({
          linha: row.linha,
          registro: row.registro,
          motivo:
            error instanceof HttpException
              ? error.message
              : 'Falha ao salvar resumo',
        });
      }
    }
    return { total: rows.length, salvos, repetidos, erros };
  }

  async macro(actor: AuthUser, buffer: Buffer) {
    requireRole(actor, ['COORDENACAO']);
    const rows = await parseMacroWorkbook(buffer);
    let salvos = 0;
    let repetidos = 0;
    const erros: { linha: number; registro: string; motivo: string }[] = [];
    for (const row of rows) {
      try {
        const current = await this.sources.macro(actor, row.pais, row.ano);
        if (
          current &&
          current.desemprego === row.desemprego &&
          current.inflacao === row.inflacao &&
          current.pib === row.pib &&
          current.fonteUrl === row.fonteUrl
        ) {
          repetidos += 1;
          continue;
        }
        await this.sources.saveMacro(actor, row.pais, row.ano, {
          desemprego: row.desemprego,
          inflacao: row.inflacao,
          pib: row.pib,
          fonteUrl: row.fonteUrl,
        });
        salvos += 1;
      } catch (error) {
        erros.push({
          linha: row.linha,
          registro: `${row.pais}/${row.ano}`,
          motivo:
            error instanceof HttpException
              ? error.message
              : 'Falha ao salvar indicador',
        });
      }
    }
    return { total: rows.length, salvos, repetidos, erros };
  }
}
