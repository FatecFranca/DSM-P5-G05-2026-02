import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ML_FEATURES, type MlFeatures } from '../ml.types';
import { validProfile } from '../profile-validation';

export const IMPORT_HEADERS = [
  'registro',
  'versaoPerfil',
  ...ML_FEATURES,
] as const;
export const IMPORT_LIMIT = 100;

export interface ImportedProfile {
  linha: number;
  registro: string;
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
    IMPORT_HEADERS.some(
      (name, index) => header.getCell(index + 1).value !== name,
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
    const versaoPerfil = row.getCell(2).value;
    if (
      typeof registro !== 'string' ||
      !registro.trim() ||
      registro.length > 40
    ) {
      throw new BadRequestException(
        `Linha ${index}: registro deve ser texto da matrícula`,
      );
    }
    if (seen.has(registro))
      throw new BadRequestException(`Linha ${index}: registro duplicado`);
    seen.add(registro);
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
      ML_FEATURES.map((name, featureIndex) => [
        name,
        row.getCell(featureIndex + 3).value,
      ]),
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
      registro,
      versaoPerfil,
      features: features as MlFeatures,
    });
  });
  if (!rows.length)
    throw new BadRequestException('A planilha não contém matrículas');
  return rows;
}
