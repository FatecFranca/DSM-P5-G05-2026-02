import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type {
  MacroSourceDto,
  SemesterSourceDto,
} from '../official-sources.dto';

const LIMIT = 100;
const SEMESTER_HEADERS = [
  'registro',
  'semestre',
  'creditadas',
  'matriculadas',
  'avaliacoes',
  'aprovadas',
  'nota',
  'semAvaliacao',
  'fonteRef',
] as const;
const MACRO_HEADERS = [
  'pais',
  'ano',
  'desemprego',
  'inflacao',
  'pib',
  'fonteUrl',
] as const;

export type SemesterRow = Omit<SemesterSourceDto, 'versao'> & {
  linha: number;
  registro: string;
  semestre: number;
};
export type MacroRow = MacroSourceDto & {
  linha: number;
  pais: string;
  ano: number;
};

export async function sourceTemplate(
  kind: 'semestres' | 'macro',
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Importacao');
  const headers = kind === 'semestres' ? SEMESTER_HEADERS : MACRO_HEADERS;
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((name) => ({
    key: name,
    width: Math.max(15, name.length + 4),
  }));
  const instructions = workbook.addWorksheet('Instrucoes');
  instructions.addRow([
    'Preencha a aba Importacao sem alterar os nomes ou a ordem das colunas.',
  ]);
  instructions.addRow([
    'Máximo de 100 linhas por arquivo. Apenas valores, sem fórmulas.',
  ]);
  instructions.addRow([
    kind === 'semestres'
      ? 'Semestre 1 ou 2; nota de 0 a 20; fonteRef identifica o documento institucional.'
      : 'País ISO de duas letras; ano 1990–2100; fonteUrl deve ser HTTPS.',
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function rows(buffer: Buffer, headers: readonly string[]) {
  if (buffer.length < 4 || buffer.subarray(0, 4).toString('hex') !== '504b0304')
    throw new BadRequestException('Envie um arquivo XLSX válido');
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      {
        ignoreNodes: ['dataValidations', 'conditionalFormatting', 'extLst'],
      },
    );
  } catch {
    throw new BadRequestException('Não foi possível ler o arquivo XLSX');
  }
  const sheet = workbook.getWorksheet('Importacao');
  if (!sheet) throw new BadRequestException('A aba Importacao é obrigatória');
  const header = sheet.getRow(1);
  if (
    header.cellCount !== headers.length ||
    headers.some((name, index) => header.getCell(index + 1).value !== name)
  )
    throw new BadRequestException(
      'Cabeçalho incompatível com o modelo de importação',
    );
  if (sheet.actualRowCount > LIMIT + 1 || sheet.columnCount > headers.length)
    throw new BadRequestException(
      `A planilha aceita até ${LIMIT} linhas e ${headers.length} colunas`,
    );
  const result: { linha: number; values: unknown[] }[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1 || !row.hasValues) return;
    if (result.length >= LIMIT)
      throw new BadRequestException(`Limite de ${LIMIT} linhas excedido`);
    result.push({
      linha: index,
      values: headers.map((_, column) => row.getCell(column + 1).value),
    });
  });
  if (!result.length)
    throw new BadRequestException('A planilha não contém dados');
  return result;
}

function integer(
  value: unknown,
  min: number,
  max: number,
  line: number,
  name: string,
) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new BadRequestException(
      `Linha ${line}: ${name} deve ser inteiro entre ${min} e ${max}`,
    );
  return value;
}

function decimal(
  value: unknown,
  min: number,
  max: number,
  line: number,
  name: string,
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new BadRequestException(
      `Linha ${line}: ${name} deve estar entre ${min} e ${max}`,
    );
  return value;
}

function label(value: unknown, max: number, line: number, name: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException(
      `Linha ${line}: ${name} deve ser texto de até ${max} caracteres`,
    );
  return value.trim();
}

export async function parseSemesterWorkbook(
  buffer: Buffer,
): Promise<SemesterRow[]> {
  const items = await rows(buffer, SEMESTER_HEADERS);
  const seen = new Set<string>();
  return items.map(({ linha, values }) => {
    const registro = label(values[0], 40, linha, 'registro');
    const semestre = integer(values[1], 1, 2, linha, 'semestre');
    const key = `${registro}:${semestre}`;
    if (seen.has(key))
      throw new BadRequestException(
        `Linha ${linha}: semestre duplicado para o registro`,
      );
    seen.add(key);
    const matriculadas = integer(values[3], 0, 1000, linha, 'matriculadas');
    const semAvaliacao = integer(values[7], 0, 1000, linha, 'semAvaliacao');
    if (semAvaliacao > matriculadas)
      throw new BadRequestException(
        `Linha ${linha}: semAvaliacao excede matriculadas`,
      );
    return {
      linha,
      registro,
      semestre,
      creditadas: integer(values[2], 0, 1000, linha, 'creditadas'),
      matriculadas,
      avaliacoes: integer(values[4], 0, 1000, linha, 'avaliacoes'),
      aprovadas: integer(values[5], 0, 1000, linha, 'aprovadas'),
      nota: decimal(values[6], 0, 20, linha, 'nota'),
      semAvaliacao,
      fonteRef: label(values[8], 200, linha, 'fonteRef'),
    };
  });
}

export async function parseMacroWorkbook(buffer: Buffer): Promise<MacroRow[]> {
  const items = await rows(buffer, MACRO_HEADERS);
  const seen = new Set<string>();
  return items.map(({ linha, values }) => {
    const pais = label(values[0], 2, linha, 'pais');
    if (!/^[A-Z]{2}$/.test(pais))
      throw new BadRequestException(`Linha ${linha}: país inválido`);
    const ano = integer(values[1], 1990, 2100, linha, 'ano');
    const key = `${pais}:${ano}`;
    if (seen.has(key))
      throw new BadRequestException(`Linha ${linha}: país e ano duplicados`);
    seen.add(key);
    const fonteUrl = label(values[5], 500, linha, 'fonteUrl');
    try {
      const url = new URL(fonteUrl);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !url.hostname
      )
        throw new Error('invalid');
    } catch {
      throw new BadRequestException(`Linha ${linha}: fonteUrl deve ser HTTPS`);
    }
    return {
      linha,
      pais,
      ano,
      desemprego: decimal(values[2], 0, 100, linha, 'desemprego'),
      inflacao: decimal(values[3], -100, 100, linha, 'inflacao'),
      pib: decimal(values[4], -100, 100, linha, 'pib'),
      fonteUrl,
    };
  });
}
