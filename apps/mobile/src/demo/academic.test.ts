import assert from 'node:assert/strict';
import test from 'node:test';
import { attendanceSummary, canSubmitAssignment, createInitialAcademicState, demoStudentId, demoStudentSubjects, demoTeacherClassIds, gradeAverage } from './academic.ts';
import { demoClasses, demoStudents } from './data.ts';

test('vínculos fictícios separam turmas do docente e disciplinas do estudante', () => {
  assert.equal(demoTeacherClassIds.length, 2);
  assert.ok(demoStudentSubjects.every((subject) => subject.classId === demoStudents[8].classId));
  assert.ok(demoTeacherClassIds.every((id) => demoClasses.some((item) => item.id === id)));
});

test('notas publicadas usam média ponderada e rascunhos não aparecem', () => {
  const state = createInitialAcademicState();
  const subjectId = demoStudentSubjects[0].id;
  const assessments = state.assessments.filter((item) => item.subjectId === subjectId);
  const average = gradeAverage(assessments, state.grades, demoStudentId);
  assert.equal(average, state.grades.find((item) => item.studentId === demoStudentId && item.assessmentId === assessments[0].id)?.score);
  assert.equal(assessments.filter((item) => item.published).length, 1);
});

test('frequência conta aulas registradas sem presumir limite institucional', () => {
  const state = createInitialAcademicState();
  const lessons = state.lessons.filter((lesson) => lesson.subjectId === demoStudentSubjects[0].id);
  const result = attendanceSummary(lessons, state.attendance, demoStudentId);
  assert.equal(result.total, 2);
  assert.equal(result.present + result.absent + result.justified, 2);
  assert.equal(result.percent, 100);
});

test('entrega respeita publicação, prazo e correção já publicada', () => {
  const assignment = createInitialAcademicState().assignments[0];
  const now = Date.parse(assignment.dueAt) - 1000;
  assert.equal(canSubmitAssignment(assignment, undefined, now), true);
  assert.equal(canSubmitAssignment(assignment, undefined, Date.parse(assignment.dueAt) + 1), false);
  assert.equal(canSubmitAssignment({ ...assignment, status: 'DRAFT' }, undefined, now), false);
  assert.equal(canSubmitAssignment(assignment, { assignmentId: assignment.id, studentId: demoStudentId, fileName: 'teste.pdf', submittedAt: assignment.publishedAt!, published: true }, now), false);
});
