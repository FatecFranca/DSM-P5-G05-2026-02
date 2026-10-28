import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeEnrollments, type EnrollmentView } from './summary.ts';

const record = (average: number | null, attendance: number | null): EnrollmentView => ({
  id: 'matricula', userId: 'aluno', name: 'Estudante', registration: '123',
  classId: 'turma', className: 'Turma', course: 'Curso', average, attendance,
});

test('indicadores ignoram dados ausentes sem tratá-los como zero', () => {
  const result = summarizeEnrollments([record(null, null), record(8, 75)]);
  assert.equal(result.count, 2);
  assert.equal(result.graded, 1);
  assert.equal(result.attendanceRecorded, 1);
  assert.equal(result.meanGrade, 8);
  assert.equal(result.meanAttendance, 75);
  assert.deepEqual(result.histogram, [0, 0, 0, 0, 1]);
  const empty = summarizeEnrollments([record(null, null)]);
  assert.equal(empty.meanGrade, null);
  assert.equal(empty.meanAttendance, null);
});
