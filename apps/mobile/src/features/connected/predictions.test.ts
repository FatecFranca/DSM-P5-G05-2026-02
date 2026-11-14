import assert from 'node:assert/strict';
import test from 'node:test';
import type { MlImportedPrediction } from '../../services/ml.ts';
import type { EnrollmentView } from './summary.ts';
import { classPredictionSummary, currentPredictions, highestDropout } from './predictions.ts';

const prediction = (registro: string, dropout: number, graduate: number, calculadoEm: string, atual = true): MlImportedPrediction => ({
  id: `${registro}-${calculadoEm}`, registro, modelVersion: 'v1', perfilVersao: 1,
  predictedClass: dropout > graduate ? 'Dropout' : 'Graduate',
  probabilities: { Dropout: dropout, Graduate: graduate }, calculadoEm, atual, status: 'EXPERIMENTAL',
});
const enrollment = (registration: string, classId: string): EnrollmentView => ({
  id: registration, userId: registration, name: registration, registration,
  classId, className: classId, course: 'Curso', average: null, attendance: null,
});

test('usa a previsão atual mais recente e não conta matrículas sem análise', () => {
  const latest = currentPredictions([
    prediction('A', 0.9, 0.1, '2026-11-01', false),
    prediction('A', 0.3, 0.7, '2026-11-02'),
    prediction('A', 0.4, 0.6, '2026-11-03'),
    prediction('B', 0.8, 0.2, '2026-11-02'),
  ]);
  const students = [enrollment('A', 'Turma 1'), enrollment('B', 'Turma 1'), enrollment('C', 'Turma 1')];
  assert.equal(classPredictionSummary(students, latest).count, 2);
  assert.ok(Math.abs(classPredictionSummary(students, latest).dropout! - 0.6) < 1e-12);
  assert.ok(Math.abs(classPredictionSummary(students, latest).graduate! - 0.4) < 1e-12);
  assert.deepEqual(highestDropout(students, latest).map((item) => item.registration), ['B', 'A']);
  assert.deepEqual(classPredictionSummary([enrollment('C', 'Turma 2')], latest), { count: 0, dropout: null, graduate: null });
});
