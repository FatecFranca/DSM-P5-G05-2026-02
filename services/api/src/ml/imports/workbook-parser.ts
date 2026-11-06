import { BadRequestException } from '@nestjs/common';
import { Workbook, type DataValidation } from 'exceljs';
import { ML_FEATURES, type MlFeatures } from '../ml.types';
import { ML_CATEGORIES } from '../input-categories';
import { validProfile } from '../profile-validation';
import { CATEGORY_LABELS, FEATURE_LABELS } from './feature-labels';

const LEGACY_IMPORT_HEADERS = [
  'registro',
  'alunoNome',
  'alunoEmail',
  'turmaNome',
  'turmaCurso',
  'turmaPeriodo',
  'disciplinaNome',
  'professorEmail',
  'versaoPerfil',
  ...ML_FEATURES,
] as const;
export const IMPORT_HEADERS = [
  'Registro (matrícula)',
  'Nome do aluno',
  'E-mail do aluno',
  'Turma',
  'Curso da turma',
  'Período da turma',
  'Disciplina',
  'E-mail do professor',
  'Versão do perfil',
  ...ML_FEATURES.map((name) => FEATURE_LABELS[name]),
] as const;
export const IMPORT_LIMIT = 100;

export async function createImportTemplate(): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Importacao');
  sheet.addRow([...IMPORT_HEADERS]);
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];
  sheet.autoFilter = { from: 'A1', to: 'AS1' };
  sheet.getRow(1).height = 36;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  sheet.columns.forEach((column, index) => {
    column.width = index < 9 ? 26 : 30;
    sheet.getRow(1).getCell(index + 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: index < 9 ? 'FF214E69' : 'FF2B6A52' },
    };
  });
  const options = workbook.addWorksheet('Opcoes');
  let optionColumn = 0;
  for (const [feature, codes] of Object.entries(ML_CATEGORIES)) {
    optionColumn += 1;
    const column = options.getColumn(optionColumn);
    column.width = 65;
    column.values = [
      FEATURE_LABELS[feature as keyof typeof FEATURE_LABELS],
      ...codes.map((code) => CATEGORY_LABELS[feature][code]),
    ];
    options.getCell(1, optionColumn).font = { bold: true };
    const letter = column.letter;
    workbook.definedNames.add(
      `Opcoes!$${letter}$2:$${letter}$${codes.length + 1}`,
      `Lista_${feature}`,
    );
    const importColumn = sheet.getColumn(
      ML_FEATURES.indexOf(feature as (typeof ML_FEATURES)[number]) + 10,
    ).letter;
    const validations = (
      sheet as unknown as {
        dataValidations: {
          add(address: string, validation: DataValidation): void;
        };
      }
    ).dataValidations;
    for (let row = 2; row <= IMPORT_LIMIT + 1; row += 1) {
      validations.add(`${importColumn}${row}`, {
        type: 'list',
        allowBlank: false,
        formulae: [`Lista_${feature}`],
        showErrorMessage: true,
        errorTitle: 'Opção inválida',
        error: 'Escolha uma opção da lista da aba Opcoes.',
      });
    }
  }
  const instructions = workbook.addWorksheet('Instrucoes');
  [
    'Preencha uma linha por matrícula. Turma, curso, período, disciplina e professor devem existir na instituição.',
    'O professor deve estar lotado na disciplina da turma. Os trabalhos publicados nessa turma serão vinculados automaticamente.',
    'Para aluno novo, o sistema cria usuário com senha temporária Fatec@123 e exige troca no primeiro acesso.',
    'Versão do perfil: 0 para perfil novo; para atualizar, use a versão atual informada pelo sistema.',
    'Nas colunas com lista, selecione a descrição da aba Opcoes. A importação traduz o texto para o código do modelo.',
    'Nas demais colunas, informe números nas faixas indicadas na aba Atributos. Não altere os títulos das colunas.',
    'Curso da turma é um cadastro local. Curso de origem UCI é um atributo experimental do modelo e exige uma categoria equivalente comprovada.',
    'Fonte dos códigos: https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success',
  ].forEach((line) => instructions.addRow([line]));
  instructions.getColumn(1).width = 110;
  const attributes = workbook.addWorksheet('Atributos');
  attributes.addRow(['Campo', 'Como preencher']);
  for (const name of ML_FEATURES) {
    const category = ML_CATEGORIES[name];
    const rule = category
      ? 'Selecione uma descrição na aba Opcoes'
      : ['nota_admissao', 'nota_qual_anterior'].includes(name)
        ? 'Número entre 0 e 200'
        : ['ucs_1sem_nota', 'ucs_2sem_nota'].includes(name)
          ? 'Número entre 0 e 20'
          : (name.startsWith('ucs_') && !name.endsWith('_nota')) ||
              ['idade_matricula', 'ordem_candidatura'].includes(name)
            ? 'Inteiro não negativo'
            : 'Número finito';
    attributes.addRow([FEATURE_LABELS[name], rule]);
  }
  attributes.getColumn(1).width = 45;
  attributes.getColumn(2).width = 100;
  attributes.getRow(1).font = { bold: true };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface ImportedProfile {
  linha: number;
  registro: string;
  alunoNome: string;
  alunoEmail: string;
  turmaNome: string;
  turmaCurso: string;
  turmaPeriodo: string;
  disciplinaNome: string;
  professorEmail: string;
  versaoPerfil: number;
  features: MlFeatures;
}

export async function parseImportWorkbook(
  buffer: Buffer,
): Promise<ImportedProfile[]> {
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
  const sheet = workbook.getWorksheet('Importacao');
  if (!sheet) throw new BadRequestException('A aba Importacao é obrigatória');
  const header = sheet.getRow(1);
  if (
    header.cellCount !== IMPORT_HEADERS.length ||
    ![IMPORT_HEADERS, LEGACY_IMPORT_HEADERS].some((headers) =>
      headers.every((name, index) => header.getCell(index + 1).value === name),
    )
  ) {
    throw new BadRequestException(
      'Cabeçalho incompatível com o modelo de importação',
    );
  }
  if (
    sheet.actualRowCount > IMPORT_LIMIT + 1 ||
    sheet.columnCount > IMPORT_HEADERS.length
  ) {
    throw new BadRequestException(
      `A planilha aceita até ${IMPORT_LIMIT} matrículas e ${IMPORT_HEADERS.length} colunas`,
    );
  }
  const rows: ImportedProfile[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row, index) => {
    if (index === 1 || !row.hasValues) return;
    if (rows.length >= IMPORT_LIMIT)
      throw new BadRequestException(
        `Limite de ${IMPORT_LIMIT} linhas excedido`,
      );
    const registro = row.getCell(1).value;
    const fields = IMPORT_HEADERS.slice(1, 8).map(
      (_, fieldIndex) => row.getCell(fieldIndex + 2).value,
    );
    const versaoPerfil = row.getCell(9).value;
    if (
      typeof registro !== 'string' ||
      !registro.trim() ||
      registro.length > 40
    ) {
      throw new BadRequestException(
        `Linha ${index}: registro deve ser texto da matrícula`,
      );
    }
    const normalizedRegistro = registro.trim();
    if (seen.has(normalizedRegistro))
      throw new BadRequestException(`Linha ${index}: registro duplicado`);
    seen.add(normalizedRegistro);
    if (
      fields.some(
        (value) =>
          typeof value !== 'string' || !value.trim() || value.length > 254,
      )
    ) {
      throw new BadRequestException(
        `Linha ${index}: identificação do aluno, turma, disciplina e professor devem ser textos preenchidos`,
      );
    }
    const [
      alunoNome,
      alunoEmail,
      turmaNome,
      turmaCurso,
      turmaPeriodo,
      disciplinaNome,
      professorEmail,
    ] = (fields as string[]).map((value) => value.trim());
    if (
      alunoNome.length < 2 ||
      alunoNome.length > 160 ||
      turmaNome.length > 120 ||
      turmaCurso.length > 120 ||
      turmaPeriodo.length > 40 ||
      disciplinaNome.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alunoEmail) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(professorEmail)
    ) {
      throw new BadRequestException(`Linha ${index}: nome ou e-mail inválido`);
    }
    if (
      typeof versaoPerfil !== 'number' ||
      !Number.isSafeInteger(versaoPerfil) ||
      versaoPerfil < 0
    ) {
      throw new BadRequestException(
        `Linha ${index}: versaoPerfil deve ser inteiro não negativo`,
      );
    }
    const features = Object.fromEntries(
      ML_FEATURES.map((name, featureIndex) => {
        const raw = row.getCell(featureIndex + 10).value;
        if (typeof raw !== 'string' || !ML_CATEGORIES[name]) return [name, raw];
        const match = Object.entries(CATEGORY_LABELS[name]).find(
          ([, label]) =>
            label.localeCompare(raw.trim(), 'pt-BR', {
              sensitivity: 'accent',
            }) === 0,
        );
        if (!match)
          throw new BadRequestException(
            `Linha ${index}: valor inválido em ${FEATURE_LABELS[name]}. Use uma opção da aba Opcoes`,
          );
        return [name, Number(match[0])];
      }),
    );
    if (
      Object.values(features).some((value) => typeof value !== 'number') ||
      !validProfile(features)
    ) {
      throw new BadRequestException(
        `Linha ${index}: atributos ausentes ou incompatíveis com o modelo`,
      );
    }
    rows.push({
      linha: index,
      registro: normalizedRegistro,
      alunoNome,
      alunoEmail: alunoEmail.toLowerCase(),
      turmaNome,
      turmaCurso,
      turmaPeriodo,
      disciplinaNome,
      professorEmail: professorEmail.toLowerCase(),
      versaoPerfil,
      features: features as MlFeatures,
    });
  });
  if (!rows.length)
    throw new BadRequestException('A planilha não contém matrículas');
  return rows;
}
