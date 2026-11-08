import type { AcademicSnapshot } from '../../services/academic.ts';

export function studentSubjectData(snapshot: AcademicSnapshot, subjectId: string, enrollmentId: string) {
  const lessons = snapshot.aulas.filter((item) => item.disciplinaId === subjectId);
  const attendance = lessons.map((lesson) => ({
    lesson,
    status: snapshot.presencas.find((item) => item.aulaId === lesson.id && item.matriculaId === enrollmentId)?.situacao ?? null,
  }));
  const recorded = attendance.filter((item) => item.status !== null);
  const present = recorded.filter((item) => item.status === 'PRESENTE').length;
  const absent = recorded.filter((item) => item.status === 'FALTA').length;
  const justified = recorded.filter((item) => item.status === 'FALTA_JUSTIFICADA').length;
  const assessments = snapshot.avaliacoes.filter((item) => item.disciplinaId === subjectId && item.publicada).map((item) => ({
    assessment: item,
    grade: snapshot.notas.find((grade) => grade.avaliacaoId === item.id && grade.matriculaId === enrollmentId)?.valor ?? null,
  }));
  const graded = assessments.filter((item) => item.grade !== null && item.assessment.notaMaxima > 0 && item.assessment.peso > 0);
  const totalWeight = graded.reduce((sum, item) => sum + item.assessment.peso, 0);
  const average = totalWeight ? graded.reduce((sum, item) => sum + item.grade! / item.assessment.notaMaxima * 10 * item.assessment.peso, 0) / totalWeight : null;
  const activities = snapshot.atividades.filter((item) => item.disciplinaId === subjectId && item.estado !== 'RASCUNHO').map((item) => ({
    activity: item,
    submission: snapshot.entregas.find((submission) => submission.atividadeId === item.id && submission.matriculaId === enrollmentId) ?? null,
  }));
  return { attendance, present, absent, justified, frequency: recorded.length ? present / recorded.length * 100 : null, assessments, average, activities };
}
