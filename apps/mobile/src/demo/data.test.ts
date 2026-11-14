import assert from 'node:assert/strict';
import test from 'node:test';
import { demoClasses, demoStudents, studentsInClass, summarize } from './data.ts';

test('os dados sintéticos são consistentes entre estudantes e turmas', () => {
  assert.equal(demoStudents.length, 40);
  assert.equal(demoClasses.reduce((sum, item) => sum + studentsInClass(item.id).length, 0), 40);
  for (const student of demoStudents) {
    const total = Object.values(student.prediction.probabilities).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 0.001);
    assert.ok(demoClasses.some((item) => item.id === student.classId));
  }
  const overall = summarize(demoStudents);
  assert.equal(Object.values(overall.distributions).reduce((sum, value) => sum + value, 0), 40);
});
