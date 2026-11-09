import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { Workbook, type CellValue } from 'exceljs';

// Cadastro de pessoas por planilha. Lê as colunas PELO NOME do cabeçalho e ignora as demais, então a
// planilha do importador de ML (Registro, Nome do aluno, E-mail do aluno, Turma, Curso da turma, Período
// da turma, Disciplina, E-mail do professor, Versão do perfil e os atributos do modelo) também serve.

export const PEOPLE_IMPORT_LIMIT = 200;
export type ImportProfile = 'ALUNO' | 'PROFESSOR';

export interface ClassKey {
  nome: string;
  curso: string;
  periodo: string;
}

export interface PersonRow {
  linha: number;
  nome: string;
  email: string;
  registro?: string;
  turma?: ClassKey;
}

export interface ParsedPeople {
  rows: PersonRow[];
  errors: string[];
}

const HEADERS = {
  ALUNO: {
    nome: 'Nome do aluno',
    email: 'E-mail do aluno',
    registro: 'Registro (matrícula)',
    turma: 'Turma',
    curso: 'Curso da turma',
    periodo: 'Período da turma',
  },
  PROFESSOR: { nome: 'Nome do professor', email: 'E-mail do professor' },
} as const;

export const classKey = (turma: ClassKey) =>
  `${turma.nome}\u0000${turma.curso}\u0000${turma.periodo}`;

/** Sem acento, minúsculo e com espaços normalizados: "E-mail do Aluno " casa com "e-mail do aluno". */
export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Texto de uma célula. O Excel entrega e-mails como hiperlink e textos formatados como "rich text". */
function cellText(value: CellValue): string | null {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'object' || value instanceof Date) return null;
  if ('richText' in value) {
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  }
  if ('hyperlink' in value) return cellText(value.text);
  if ('result' in value) return cellText(value.result ?? null);
  return null;
}

async function loadSheet(buffer: Buffer) {
  if (
    buffer.length < 4 ||
    buffer.subarray(0, 4).toString('hex') !== '504b0304'
  ) {
    throw new BadRequestException('Envie um arquivo XLSX válido');
  }
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      { ignoreNodes: ['dataValidations', 'conditionalFormatting', 'extLst'] },
    );
  } catch {
    throw new BadRequestException('Não foi possível ler o arquivo XLSX');
  }
  const sheet = workbook.getWorksheet('Importacao') ?? workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('A planilha está vazia');
  return sheet;
}

export async function parsePeopleWorkbook(
  buffer: Buffer,
  perfil: ImportProfile,
): Promise<ParsedPeople> {
  const sheet = await loadSheet(buffer);
  const wanted: Record<string, string> = HEADERS[perfil];
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, index) => {
    const text = cellText(cell.value);
    if (text) columns.set(normalizeText(text), index);
  });
  const requiredKeys =
    perfil === 'ALUNO' ? ['nome', 'email', 'registro'] : ['nome', 'email'];
  const missing = requiredKeys
    .map((key) => wanted[key])
    .filter((title) => !columns.has(normalizeText(title)));
  if (missing.length) {
    throw new BadRequestException(
      `Colunas obrigatórias ausentes na primeira linha: ${missing.join(', ')}`,
    );
  }
  const column = (key: string) => columns.get(normalizeText(wanted[key] ?? ''));

  const rows: PersonRow[] = [];
  const errors: string[] = [];
  const registros = new Set<string>();
  const namesByEmail = new Map<string, string>();
  const emailsByClass = new Set<string>();
  let seenRows = 0;
  sheet.eachRow((row, index) => {
    if (index === 1 || !row.hasValues) return;
    seenRows++;
    if (seenRows > PEOPLE_IMPORT_LIMIT) return;
    const read = (key: string) => {
      const index = column(key);
      return index ? cellText(row.getCell(index).value) : '';
    };
    const nome = read('nome');
    const email = (read('email') ?? '').toLowerCase();
    const problems: string[] = [];
    if (nome === null || nome.length < 2 || nome.length > 160) {
      problems.push('nome deve ter de 2 a 160 caracteres');
    }
    if (!email || email.length > 254 || !isEmail(email)) {
      problems.push('e-mail inválido');
    }
    let registro: string | undefined;
    let turma: ClassKey | undefined;
    if (perfil === 'ALUNO') {
      const values = {
        nome: read('turma'),
        curso: read('curso'),
        periodo: read('periodo'),
      };
      const filled = Object.values(values).filter((value) => value);
      if (
        values.nome === null ||
        values.curso === null ||
        values.periodo === null
      ) {
        problems.push('turma, curso e período devem ser textos');
      } else if (filled.length === 3) {
        turma = values as ClassKey;
      } else if (filled.length > 0) {
        problems.push(
          'informe turma, curso e período juntos, ou deixe os três vazios',
        );
      }
      const raw = read('registro');
      if (turma) {
        if (!raw || raw.length > 40) {
          problems.push(
            'registro (matrícula) é obrigatório e vai até 40 caracteres',
          );
        } else {
          registro = raw;
          if (registros.has(raw))
            problems.push('registro repetido na planilha');
          registros.add(raw);
        }
      }
    }
    if (nome && email) {
      const previous = namesByEmail.get(email);
      if (
        previous !== undefined &&
        normalizeText(previous) !== normalizeText(nome)
      ) {
        problems.push('o mesmo e-mail aparece com nomes diferentes');
      }
      // O primeiro nome visto é a referência; um nome divergente não a substitui.
      if (previous === undefined) namesByEmail.set(email, nome);
      if (turma) {
        const key = `${email}|${classKey(turma)}`;
        if (emailsByClass.has(key))
          problems.push('pessoa repetida na mesma turma');
        emailsByClass.add(key);
      }
    }
    if (problems.length) {
      errors.push(`Linha ${index}: ${problems.join('; ')}`);
      return;
    }
    rows.push({ linha: index, nome: nome as string, email, registro, turma });
  });
  if (seenRows > PEOPLE_IMPORT_LIMIT) {
    throw new BadRequestException(
      `A planilha aceita até ${PEOPLE_IMPORT_LIMIT} linhas por envio; divida em mais de um arquivo`,
    );
  }
  if (!seenRows) {
    throw new BadRequestException(
      'A planilha não tem nenhuma linha preenchida',
    );
  }
  return { rows, errors };
}

/** Modelo para baixar. Sem linha de exemplo preenchida: ela seria importada como pessoa de verdade. */
export async function createPeopleTemplate(
  perfil: ImportProfile,
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Importacao');
  const titles =
    perfil === 'ALUNO'
      ? [
          'Registro (matrícula)',
          'Nome do aluno',
          'E-mail do aluno',
          'Turma',
          'Curso da turma',
          'Período da turma',
        ]
      : ['Nome do professor', 'E-mail do professor'];
  sheet.addRow(titles);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).height = 30;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  titles.forEach((_, index) => {
    sheet.getColumn(index + 1).width = 30;
    sheet.getRow(1).getCell(index + 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF214E69' },
    };
  });
  if (perfil === 'ALUNO') {
    sheet.getColumn(1).numFmt = '@'; // matrícula como texto: não perde zeros à esquerda
  }
  const help = workbook.addWorksheet('Instrucoes');
  const lines =
    perfil === 'ALUNO'
      ? [
          'Uma linha por matrícula. Registro, nome, e-mail, turma, curso e período são lidos pelo título da coluna.',
          'A turma precisa existir e estar aberta. Se a pessoa já tem conta (mesmo e-mail e nome), só a matrícula é criada.',
          'Deixe turma, curso e período vazios para criar apenas a conta, sem matrícula.',
          'A planilha do importador de previsões também serve: colunas como Disciplina, E-mail do professor e os atributos do modelo são ignoradas.',
          `Até ${PEOPLE_IMPORT_LIMIT} linhas por envio. Se houver qualquer erro, nada é importado e cada problema é listado com o número da linha.`,
          'Cada conta nova recebe uma senha temporária única, mostrada uma vez ao fim da importação. A pessoa troca no primeiro acesso.',
        ]
      : [
          'Uma linha por professor: nome e e-mail, lidos pelo título da coluna.',
          'A lotação em disciplinas é feita depois, na área acadêmica.',
          `Até ${PEOPLE_IMPORT_LIMIT} linhas por envio. Se houver qualquer erro, nada é importado.`,
          'Cada conta nova recebe uma senha temporária única, mostrada uma vez ao fim da importação. A pessoa troca no primeiro acesso.',
        ];
  lines.forEach((line) => help.addRow([line]));
  help.getColumn(1).width = 120;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
