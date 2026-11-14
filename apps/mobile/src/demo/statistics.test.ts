import assert from 'node:assert/strict';
import test from 'node:test';
import { demoStudents } from './data.ts';
import { describeStudents, evaluateConfusionMatrix, mean, median } from './statistics.ts';

test('média, mediana e histograma refletem a seleção de estudantes', () => {
  assert.equal(mean([]), null);
  assert.equal(median([9, 3, 5, 7]), 6);
  const subset = demoStudents.slice(0, 4);
  const summary = describeStudents(subset);
  assert.equal(summary.count, 4);
  assert.equal(summary.histogram.reduce((sum, value) => sum + value, 0), 4);
  assert.equal(Object.values(summary.riskCounts).reduce((sum, value) => sum + value, 0), 4);
  assert.equal(summary.meanGrade, mean(subset.map((student) => student.academicAverage)));
});

test('métricas da matriz usam linhas como classe real e colunas como prevista', () => {
  const result = evaluateConfusionMatrix([[8, 2, 0], [1, 7, 2], [0, 2, 8]]);
  assert.equal(result.total, 30);
  assert.ok(Math.abs(result.accuracy - 23 / 30) < 0.0001);
  assert.ok(Math.abs(result.classes[0].precision - 8 / 9) < 0.0001);
  assert.equal(result.classes[0].recall, 0.8);
  assert.ok(result.macroF1 > 0 && result.macroF1 < 1);
});
