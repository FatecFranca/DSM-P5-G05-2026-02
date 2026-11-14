import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluationDetails, modelReport, summarizeRecent, type MlPredictionRecord } from './model-report.ts';

test('deriva precisão, recall, F1 e suporte da matriz documentada', () => {
  const result = evaluationDetails(modelReport.confusionMatrix);
  assert.equal(result.total, modelReport.validationSamples);
  assert.equal(result.perClass[0].support, 284);
  assert.equal(result.perClass[1].support, 442);
  assert.ok(Math.abs(result.perClass[0].recall - 0.8556338028169014) < 1e-12);
  assert.ok(Math.abs((result.perClass[0].f1 + result.perClass[1].f1) / 2 - modelReport.macroF1) < 1e-12);
  assert.ok(Math.abs((243 + 416) / result.total - modelReport.accuracy) < 1e-12);
});

test('separa previsões atuais, antigas e de outras versões', () => {
  const record = (id: string, modelVersion: string, atual: boolean, predictedClass: MlPredictionRecord['predictedClass']): MlPredictionRecord => ({ id, modelVersion, atual, predictedClass, calculadoEm: '2026-11-10T12:00:00.000Z', status: 'EXPERIMENTAL' });
  const result = summarizeRecent([
    record('1', modelReport.version, true, 'Dropout'),
    record('2', modelReport.version, false, 'Graduate'),
    record('3', 'versao-antiga', true, 'Dropout'),
  ], modelReport.version);
  assert.equal(result.current, 1);
  assert.equal(result.stale, 1);
  assert.equal(result.otherVersions, 1);
  assert.deepEqual(result.counts, { Dropout: 1, Enrolled: 0, Graduate: 0 });
});
