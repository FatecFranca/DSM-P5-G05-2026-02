export const ML_CLASSES = ['Dropout', 'Enrolled', 'Graduate'] as const;

export const ML_FEATURES = [
  'estado_civil',
  'modo_candidatura',
  'ordem_candidatura',
  'curso',
  'periodo_aula',
  'qualif_anterior',
  'nota_qual_anterior',
  'nacionalidade',
  'qualif_mae',
  'qualif_pai',
  'ocupacao_mae',
  'ocupacao_pai',
  'nota_admissao',
  'deslocado',
  'necessidades_especiais',
  'devedor',
  'mensalidade_em_dia',
  'genero',
  'bolsista',
  'idade_matricula',
  'internacional',
  'ucs_1sem_creditadas',
  'ucs_1sem_matriculadas',
  'ucs_1sem_avaliacoes',
  'ucs_1sem_aprovadas',
  'ucs_1sem_nota',
  'ucs_1sem_sem_aval',
  'ucs_2sem_creditadas',
  'ucs_2sem_matriculadas',
  'ucs_2sem_avaliacoes',
  'ucs_2sem_aprovadas',
  'ucs_2sem_nota',
  'ucs_2sem_sem_aval',
  'desemprego',
  'inflacao',
  'pib',
] as const;

export type MlClass = (typeof ML_CLASSES)[number];
export type MlFeatures = Record<(typeof ML_FEATURES)[number], number>;

export interface MlBatchRequest {
  model_version: string;
  request_id: string;
  items: Array<{ ref: string; features: MlFeatures }>;
}

export interface MlBatchResponse {
  model_version: string;
  request_id: string;
  results: Array<{
    ref: string;
    predicted_class: MlClass;
    probabilities: Record<MlClass, number>;
  }>;
}

export interface MlPreviewResponse {
  modelVersion: string;
  predictedClass: MlClass;
  probabilities: Record<MlClass, number>;
}
