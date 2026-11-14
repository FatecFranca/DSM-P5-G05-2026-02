import type { MlPredictionRecord, ModelClass } from './model-report';

export const MAX_WORKBOOK_BYTES = 1024 * 1024;

export function workbookError(file: Pick<File, 'name' | 'size'>): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Selecione uma planilha .xlsx.';
  if (file.size === 0) return 'A planilha está vazia.';
  if (file.size > MAX_WORKBOOK_BYTES) return 'A planilha deve ter até 1 MB.';
  return null;
}

export interface MlImportResult {
  modelVersion: string;
  arquivoSha256: string;
  total: number;
  salvos: number;
  usuariosCriados: number;
  matriculasCriadas: number;
  repetidos: number;
  erros: { linha: number; registro: string; motivo: string }[];
  status: 'EXPERIMENTAL';
}

export interface MlImportedPrediction extends MlPredictionRecord {
  registro: string;
  perfilVersao: number;
  probabilities: Partial<Record<ModelClass, number>>;
}
