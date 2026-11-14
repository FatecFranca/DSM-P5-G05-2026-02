import type { EnrollmentView } from './summary.ts';
import type { MlImportedPrediction } from '../../services/ml.ts';

export type PredictionMap = Record<string, MlImportedPrediction>;

export function currentPredictions(items: MlImportedPrediction[]): PredictionMap {
  const latest: PredictionMap = {};
  for (const item of items) {
    if (!item.atual) continue;
    const previous = latest[item.registro];
    if (!previous || item.calculadoEm > previous.calculadoEm) latest[item.registro] = item;
  }
  return latest;
}

export function classPredictionSummary(enrollments: EnrollmentView[], predictions: PredictionMap) {
  const matched = enrollments.flatMap((item) => predictions[item.registration] ? [predictions[item.registration]] : []);
  const count = matched.length;
  return {
    count,
    dropout: count ? matched.reduce((sum, item) => sum + item.probabilities.Dropout, 0) / count : null,
    graduate: count ? matched.reduce((sum, item) => sum + item.probabilities.Graduate, 0) / count : null,
  };
}

export function highestDropout(enrollments: EnrollmentView[], predictions: PredictionMap) {
  return enrollments.filter((item) => !!predictions[item.registration])
    .sort((a, b) => predictions[b.registration].probabilities.Dropout - predictions[a.registration].probabilities.Dropout);
}
