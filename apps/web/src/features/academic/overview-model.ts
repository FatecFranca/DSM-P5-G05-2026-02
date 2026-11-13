import type { AcademicSnapshot } from '../../services/contracts';

export interface ClassView { id: string; name: string; course: string; period: string; closed: boolean; snapshot: AcademicSnapshot }
export interface EnrollmentView { id: string; userId: string; name: string; registration: string; classId: string; className: string; average: number | null; attendance: number | null }
export interface Overview { classes: ClassView[]; enrollments: EnrollmentView[] }

export function buildOverview(first: AcademicSnapshot, snapshots: AcademicSnapshot[]): Overview {
  if (snapshots.some((item) => item.truncated)) throw new Error('A consulta acadêmica está incompleta. Atualize os dados para continuar.');
  if (snapshots.length !== first.turmas.length || snapshots.some((snapshot, index) => snapshot.turmaId !== first.turmas[index].id)) throw new Error('A consulta acadêmica não corresponde às turmas solicitadas.');
  const classes = first.turmas.map((item, index) => ({ id: item.id, name: item.nome, course: item.curso, period: item.periodo, closed: item.fechada, snapshot: snapshots[index] }));
  const enrollments = classes.flatMap((item) => item.snapshot.matriculas.map((matricula) => {
    const indicator = item.snapshot.indicadores.find((value) => value.matriculaId === matricula.id);
    return { id: matricula.id, userId: matricula.alunoId, name: matricula.aluno.nome, registration: matricula.registro, classId: item.id, className: item.name, average: indicator?.media ?? null, attendance: indicator?.frequencia ?? null };
  }));
  return { classes, enrollments };
}

export function average(values: (number | null)[]): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}
