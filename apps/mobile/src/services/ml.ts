export interface MlSchema { features: string[]; classes: string[]; mode: 'TECHNICAL_PREVIEW'; previewEnabled: boolean }
export interface MlStatus { configured: boolean; ready: boolean; modelVersion?: string }
export interface MlPrediction { modelVersion: string; predictedClass: 'Dropout' | 'Enrolled' | 'Graduate'; probabilities: Record<'Dropout' | 'Enrolled' | 'Graduate', number> }

export function parseMlFeatures(input: string, names: readonly string[]): Record<string, number> {
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error('Informe um objeto JSON válido com os atributos numéricos.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Os atributos devem formar um objeto.');
  const data = value as Record<string, unknown>;
  const missing = names.filter((name) => !Object.hasOwn(data, name));
  if (missing.length) throw new Error(`Dados insuficientes. Faltam: ${missing.join(', ')}.`);
  const extra = Object.keys(data).filter((name) => !names.includes(name));
  if (extra.length) throw new Error(`Campos não permitidos: ${extra.join(', ')}. Não envie classe, nomes ou identificadores pessoais.`);
  if (names.some((name) => typeof data[name] !== 'number' || !Number.isFinite(data[name]))) throw new Error('Todos os atributos devem ser números finitos, sem valores vazios ou nulos.');
  return Object.fromEntries(names.map((name) => [name, data[name] as number]));
}
