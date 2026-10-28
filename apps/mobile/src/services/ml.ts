export interface MlSchema { features: string[]; classes: string[]; categories: Record<string, number[]> }
export interface MlStatus { configured: boolean; ready: boolean; modelVersion?: string; originalInputReady?: boolean }
export type MlInputFormat = 'original' | 'preprocessed';
export interface MlPrediction { modelVersion: string; predictedClass: 'Dropout' | 'Enrolled' | 'Graduate'; probabilities: Record<'Dropout' | 'Enrolled' | 'Graduate', number> }

export interface EnrollmentMl {
  matriculaId: string;
  aluno: string;
  registro: string;
  fonte: string;
  features?: Record<string, number>;
  faltantes: string[];
  versao: number;
  status?: 'CALCULADO' | 'INSUFICIENTE';
  impedimentos?: string[];
  resultado: (MlPrediction & { calculadoEm: string; perfilVersao: number }) | null;
}

export function canReadMl(role: string | null) {
  return ['ADMIN', 'COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(role ?? '');
}

export function canEditMl(role: string | null) {
  return ['ADMIN', 'COORDENACAO'].includes(role ?? '');
}

export function parsePartialMlFields(fields: Record<string, string>, schema: MlSchema) {
  const names = schema.features.filter((name) => (fields[name] ?? '').trim() !== '');
  const result = parseOriginalMlFields(fields, names);
  for (const name of names) {
    if (schema.categories[name] && !schema.categories[name].includes(result[name])) {
      throw new Error(`Código inválido para ${ML_FIELD_LABELS[name] ?? name}.`);
    }
  }
  return result;
}

export const ML_FIELD_LABELS: Record<string, string> = {
  estado_civil: 'Estado civil (código)', modo_candidatura: 'Modalidade de ingresso (código)', ordem_candidatura: 'Ordem da candidatura',
  curso: 'Curso (código do dataset)', periodo_aula: 'Período: diurno 1, noturno 0', qualif_anterior: 'Qualificação anterior (código)',
  nota_qual_anterior: 'Nota da qualificação anterior (0–200)', nacionalidade: 'Nacionalidade (código)', qualif_mae: 'Qualificação da mãe (código)',
  qualif_pai: 'Qualificação do pai (código)', ocupacao_mae: 'Ocupação da mãe (código)', ocupacao_pai: 'Ocupação do pai (código)',
  nota_admissao: 'Nota de admissão (0–200)', deslocado: 'Deslocado: sim 1, não 0', necessidades_especiais: 'Necessidades especiais: sim 1, não 0',
  devedor: 'Devedor: sim 1, não 0', mensalidade_em_dia: 'Mensalidade em dia: sim 1, não 0', genero: 'Gênero (código do dataset: 0 ou 1)',
  bolsista: 'Bolsista: sim 1, não 0', idade_matricula: 'Idade na matrícula (anos)', internacional: 'Internacional: sim 1, não 0',
  ucs_1sem_creditadas: '1º semestre: unidades creditadas', ucs_1sem_matriculadas: '1º semestre: unidades matriculadas',
  ucs_1sem_avaliacoes: '1º semestre: avaliações', ucs_1sem_aprovadas: '1º semestre: unidades aprovadas',
  ucs_1sem_nota: '1º semestre: média das notas (0–20)', ucs_1sem_sem_aval: '1º semestre: unidades sem avaliação',
  ucs_2sem_creditadas: '2º semestre: unidades creditadas', ucs_2sem_matriculadas: '2º semestre: unidades matriculadas',
  ucs_2sem_avaliacoes: '2º semestre: avaliações', ucs_2sem_aprovadas: '2º semestre: unidades aprovadas',
  ucs_2sem_nota: '2º semestre: média das notas (0–20)', ucs_2sem_sem_aval: '2º semestre: unidades sem avaliação',
  desemprego: 'Taxa de desemprego (%)', inflacao: 'Inflação (%)', pib: 'Variação do PIB (%)',
};

export function parseOriginalMlFields(fields: Record<string, string>, names: readonly string[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const name of names) {
    const text = (fields[name] ?? '').trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) {
      throw new Error(`Preencha ${ML_FIELD_LABELS[name] ?? name} com um número válido. Dados ausentes não podem ser substituídos por zero.`);
    }
    values[name] = Number(text);
  }
  return values;
}

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
