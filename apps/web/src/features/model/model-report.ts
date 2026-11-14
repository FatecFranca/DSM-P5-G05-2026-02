export type ModelClass = 'Dropout' | 'Enrolled' | 'Graduate';

export interface MlStatus {
  configured: boolean;
  ready: boolean;
  modelVersion?: string;
  originalInputReady?: boolean;
  classes?: ModelClass[];
}

export interface MlSchema {
  features: string[];
  classes: ModelClass[];
  mode: 'TECHNICAL_PREVIEW';
  previewEnabled: boolean;
}

export interface MlPredictionRecord {
  id: string;
  modelVersion: string;
  predictedClass: ModelClass;
  calculadoEm: string;
  atual: boolean;
  status: 'EXPERIMENTAL';
}

// Relatórios versionados em back/prototype:services/ml/candidates/externo-lr-sem-enrolled-v1{,.calibration}.json.
// Só é exibido como avaliação do modelo ativo quando /ml/status confirma esta versão.
export const modelReport = {
  version: 'externo-lr-sem-enrolled-v1',
  algorithm: 'Regressão logística balanceada',
  classes: ['Dropout', 'Graduate'],
  features: 36,
  inputScale: 'Valores originais',
  sklearnVersion: '1.8.0',
  calibrated: false,
  artifactSha256: 'fbc7d381435551924dc09439da7a203aa02c5592a02d0d4fc963770887a2e5fd',
  validationDatasetSha256: '3ef126de5cefff26eb11fbb4237f1a1401cb64b488e2f1d598c23cedeb4c45ae',
  validationMethod: 'Divisão estratificada 80/20, semente 7',
  trainingAfterOutliers: 2730,
  validationSamples: 726,
  accuracy: 0.9077134986225895,
  macroF1: 0.9021577119041249,
  dropoutBrier: 0.06929653828336252,
  calibrationAssessment: {
    sampleSize: 726,
    expectedDropoutCount: 302.2897094173002,
    observedDropoutCount: 284,
    meanProbability: 0.4163770102166669,
    observedRate: 0.39118457300275483,
    observedMinusPredicted: -0.025192437213912115,
    observedMinusPredicted95Ci: [-0.04427032901600875, -0.005997254054791705],
    expectedCalibrationError: 0.028140345735406923,
  },
  // Linhas: classe real; colunas: classe prevista. Ordem: Dropout, Graduate.
  confusionMatrix: [[243, 41], [26, 416]] as const,
} as const;

export interface ClassMetrics { label: 'Dropout' | 'Graduate'; support: number; precision: number; recall: number; f1: number }

export function evaluationDetails(matrix: readonly (readonly number[])[]) {
  const [dropout, graduate] = matrix;
  if (!dropout || !graduate || dropout.length !== 2 || graduate.length !== 2) throw new Error('Matriz de confusão inválida.');
  const [dd, dg] = dropout;
  const [gd, gg] = graduate;
  if ([dd, dg, gd, gg].some((value) => !Number.isInteger(value) || value < 0)) throw new Error('Matriz de confusão inválida.');
  const ratio = (top: number, bottom: number) => bottom ? top / bottom : 0;
  const perClass: ClassMetrics[] = [
    { label: 'Dropout', support: dd + dg, precision: ratio(dd, dd + gd), recall: ratio(dd, dd + dg), f1: ratio(2 * dd, 2 * dd + dg + gd) },
    { label: 'Graduate', support: gd + gg, precision: ratio(gg, gg + dg), recall: ratio(gg, gg + gd), f1: ratio(2 * gg, 2 * gg + dg + gd) },
  ];
  return { perClass, balancedAccuracy: (perClass[0].recall + perClass[1].recall) / 2, total: dd + dg + gd + gg };
}

export function summarizeRecent(records: readonly MlPredictionRecord[], version: string) {
  const matching = records.filter((record) => record.modelVersion === version);
  const current = matching.filter((record) => record.atual);
  return {
    totalReturned: records.length,
    matchingVersion: matching.length,
    current: current.length,
    stale: matching.length - current.length,
    otherVersions: records.length - matching.length,
    counts: {
      Dropout: current.filter((record) => record.predictedClass === 'Dropout').length,
      Enrolled: current.filter((record) => record.predictedClass === 'Enrolled').length,
      Graduate: current.filter((record) => record.predictedClass === 'Graduate').length,
    },
    latestAt: matching[0]?.calculadoEm ?? null,
  };
}
