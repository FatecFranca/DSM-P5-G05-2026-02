import { demoClasses, demoStudents, studentsInClass } from './data.ts';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'JUSTIFIED';
export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export interface Subject {
  id: string;
  title: string;
  classId: string;
  semester: string;
  course: string;
}

export interface Lesson {
  id: string;
  subjectId: string;
  date: string;
  topic: string;
}

export interface AttendanceRecord {
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  subjectId: string;
  title: string;
  weight: number;
  maxScore: number;
  date: string;
  published: boolean;
}

export interface GradeRecord {
  assessmentId: string;
  studentId: string;
  score: number;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  dueAt: string;
  maxScore: number;
  status: AssignmentStatus;
  publishedAt?: string;
}

export interface Submission {
  assignmentId: string;
  studentId: string;
  fileName: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
  published?: boolean;
  correctedAt?: string;
}

export interface Material {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  fileName: string;
  publishedAt: string;
}

export interface AcademicState {
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  assessments: Assessment[];
  grades: GradeRecord[];
  assignments: Assignment[];
  submissions: Submission[];
  materials: Material[];
}

export const demoTeacherClassIds = [demoClasses[0].id, demoClasses[2].id];
export const demoStudentId = demoStudents[8].id;
export const demoScale = 10;
export const demoReferenceTime = Date.now();

export const demoSubjects: Subject[] = [
  { id: 'algoritmos', title: 'Algoritmos e lógica', classId: demoClasses[0].id, semester: '2026.1', course: 'ADS' },
  { id: 'banco-dados', title: 'Banco de dados', classId: demoClasses[0].id, semester: '2026.1', course: 'ADS' },
  { id: 'mobile', title: 'Desenvolvimento mobile', classId: demoClasses[2].id, semester: '2026.1', course: 'DSM' },
  { id: 'engenharia', title: 'Engenharia de software', classId: demoClasses[2].id, semester: '2026.1', course: 'DSM' },
];

export const demoTeacherSubjects = demoSubjects.filter((subject) => demoTeacherClassIds.includes(subject.classId));
export const demoStudentSubjects = demoSubjects.filter((subject) => subject.classId === demoStudents[8].classId);

function daysFromNow(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function createInitialAcademicState(): AcademicState {
  const lessons = demoSubjects.flatMap((subject) => [
    { id: `${subject.id}-aula-1`, subjectId: subject.id, date: daysFromNow(-7), topic: 'Introdução e fundamentos' },
    { id: `${subject.id}-aula-2`, subjectId: subject.id, date: daysFromNow(-2), topic: 'Exercícios aplicados' },
    { id: `${subject.id}-aula-3`, subjectId: subject.id, date: daysFromNow(0), topic: 'Aula de hoje' },
  ]);
  const attendance = lessons.filter((lesson) => !lesson.id.endsWith('3')).flatMap((lesson) => {
    const subject = demoSubjects.find((item) => item.id === lesson.subjectId)!;
    return studentsInClass(subject.classId).map((student, index) => ({
      lessonId: lesson.id, studentId: student.id,
      status: (index % 5 === 0 ? 'ABSENT' : 'PRESENT') as AttendanceStatus,
      updatedAt: lesson.date,
    }));
  });
  const assessments = demoSubjects.flatMap((subject) => [
    { id: `${subject.id}-avaliacao-1`, subjectId: subject.id, title: 'Avaliação 1', weight: 2, maxScore: demoScale, date: daysFromNow(-5), published: true },
    { id: `${subject.id}-avaliacao-2`, subjectId: subject.id, title: 'Avaliação 2', weight: 3, maxScore: demoScale, date: daysFromNow(8), published: false },
  ]);
  const grades = assessments.filter((assessment) => assessment.published).flatMap((assessment) => {
    const subject = demoSubjects.find((item) => item.id === assessment.subjectId)!;
    return studentsInClass(subject.classId).map((student, index) => ({
      assessmentId: assessment.id, studentId: student.id,
      score: Math.min(demoScale, 5 + (index % 5) + (subject.id === 'banco-dados' ? 0.5 : 0)),
      updatedAt: assessment.date,
    }));
  });
  const assignments: Assignment[] = demoSubjects.map((subject) => ({
    id: `${subject.id}-trabalho`, subjectId: subject.id, title: 'Estudo de caso',
    description: `Produza uma análise curta sobre ${subject.title.toLowerCase()} e anexe um arquivo.`,
    dueAt: daysFromNow(10), maxScore: demoScale, status: 'PUBLISHED', publishedAt: daysFromNow(-3),
  }));
  const materials: Material[] = demoSubjects.map((subject) => ({
    id: `${subject.id}-material`, subjectId: subject.id, title: 'Roteiro da unidade',
    description: `Material introdutório de ${subject.title.toLowerCase()}.`,
    fileName: 'roteiro-demo.pdf', publishedAt: daysFromNow(-6),
  }));
  return { lessons, attendance, assessments, grades, assignments, submissions: [], materials };
}

export function gradeAverage(assessments: Assessment[], grades: GradeRecord[], studentId: string): number | null {
  const items = assessments.filter((assessment) => assessment.published).flatMap((assessment) => {
    const grade = grades.find((record) => record.assessmentId === assessment.id && record.studentId === studentId);
    return grade ? [{ weight: assessment.weight, normalized: grade.score / assessment.maxScore * demoScale }] : [];
  });
  const weight = items.reduce((sum, item) => sum + item.weight, 0);
  return weight ? items.reduce((sum, item) => sum + item.weight * item.normalized, 0) / weight : null;
}

export function attendanceSummary(lessons: Lesson[], records: AttendanceRecord[], studentId: string) {
  const relevant = lessons.filter((lesson) => records.some((record) => record.lessonId === lesson.id && record.studentId === studentId));
  const statuses = relevant.map((lesson) => records.find((record) => record.lessonId === lesson.id && record.studentId === studentId)!.status);
  const present = statuses.filter((status) => status === 'PRESENT').length;
  const absent = statuses.filter((status) => status === 'ABSENT').length;
  const justified = statuses.filter((status) => status === 'JUSTIFIED').length;
  return { total: relevant.length, present, absent, justified, percent: relevant.length ? present / relevant.length * 100 : null };
}

export function subjectForClass(classId: string) {
  return demoSubjects.filter((subject) => subject.classId === classId);
}

export function canSubmitAssignment(assignment: Assignment, submission: Submission | undefined, now: number): boolean {
  return assignment.status === 'PUBLISHED' && Date.parse(assignment.dueAt) >= now && !submission?.published;
}
