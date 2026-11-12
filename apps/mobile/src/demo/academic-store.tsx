import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSession } from '@/auth/session';
import { studentsInClass } from './data';
import {
  canSubmitAssignment, createInitialAcademicState, demoStudentId, demoStudentSubjects, demoSubjects, demoTeacherClassIds,
  type AcademicState, type Assessment, type Assignment, type AttendanceStatus, type Material,
} from './academic';

interface AcademicDemoContextValue {
  data: AcademicState;
  saveAttendance: (lessonId: string, statuses: Record<string, AttendanceStatus>) => void;
  createAssessment: (input: Pick<Assessment, 'subjectId' | 'title' | 'weight' | 'maxScore' | 'date'>) => void;
  saveGrades: (assessmentId: string, scores: Record<string, number>) => void;
  publishAssessment: (assessmentId: string) => void;
  createAssignment: (input: Pick<Assignment, 'subjectId' | 'title' | 'description' | 'dueAt' | 'maxScore' | 'status'>) => void;
  publishAssignment: (assignmentId: string) => void;
  submitAssignment: (assignmentId: string, fileName: string) => void;
  gradeSubmission: (assignmentId: string, studentId: string, score: number, feedback: string) => void;
  createMaterial: (input: Pick<Material, 'subjectId' | 'title' | 'description' | 'fileName'>) => void;
}

const AcademicDemoContext = createContext<AcademicDemoContextValue | null>(null);
const demoId = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function AcademicDemoProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const [data, setData] = useState(createInitialAcademicState);

  function teacherSubject(subjectId: string) {
    const subject = demoSubjects.find((item) => item.id === subjectId);
    if (state.status !== 'signedIn' || state.user.perfil !== 'PROFESSOR' || !subject || !demoTeacherClassIds.includes(subject.classId)) {
      throw new Error('Ação disponível somente para o docente vinculado à disciplina demonstrativa.');
    }
    return subject;
  }

  function saveAttendance(lessonId: string, statuses: Record<string, AttendanceStatus>) {
    const lesson = data.lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error('Aula não encontrada.');
    const subject = teacherSubject(lesson.subjectId);
    const allowed = new Set(studentsInClass(subject.classId).map((student) => student.id));
    if (Object.keys(statuses).some((id) => !allowed.has(id))) throw new Error('Estudante fora da turma vinculada.');
    const updatedAt = new Date().toISOString();
    setData((current) => ({ ...current, attendance: [
      ...current.attendance.filter((record) => record.lessonId !== lessonId || !(record.studentId in statuses)),
      ...Object.entries(statuses).map(([studentId, status]) => ({ lessonId, studentId, status, updatedAt })),
    ] }));
  }

  function createAssessment(input: Pick<Assessment, 'subjectId' | 'title' | 'weight' | 'maxScore' | 'date'>) {
    teacherSubject(input.subjectId);
    if (!input.title.trim() || input.weight <= 0 || input.maxScore <= 0 || !Number.isFinite(input.weight) || !Number.isFinite(input.maxScore) || Number.isNaN(Date.parse(input.date))) throw new Error('Informe título, data, peso e nota máxima válidos.');
    const assessment: Assessment = { ...input, id: demoId(), title: input.title.trim(), published: false };
    setData((current) => ({ ...current, assessments: [...current.assessments, assessment] }));
  }

  function saveGrades(assessmentId: string, scores: Record<string, number>) {
    const assessment = data.assessments.find((item) => item.id === assessmentId);
    if (!assessment) throw new Error('Avaliação não encontrada.');
    const subject = teacherSubject(assessment.subjectId);
    const allowed = new Set(studentsInClass(subject.classId).map((student) => student.id));
    if (Object.entries(scores).some(([id, score]) => !allowed.has(id) || !Number.isFinite(score) || score < 0 || score > assessment.maxScore)) throw new Error('Há notas inválidas ou estudante fora da turma.');
    const updatedAt = new Date().toISOString();
    setData((current) => ({ ...current, grades: [
      ...current.grades.filter((record) => record.assessmentId !== assessmentId || !(record.studentId in scores)),
      ...Object.entries(scores).map(([studentId, score]) => ({ assessmentId, studentId, score, updatedAt })),
    ] }));
  }

  function publishAssessment(assessmentId: string) {
    const assessment = data.assessments.find((item) => item.id === assessmentId);
    if (!assessment) throw new Error('Avaliação não encontrada.');
    const subject = teacherSubject(assessment.subjectId);
    const students = studentsInClass(subject.classId);
    if (students.some((student) => !data.grades.some((grade) => grade.assessmentId === assessmentId && grade.studentId === student.id))) throw new Error('Lance as notas de todos os estudantes antes de publicar.');
    setData((current) => ({ ...current, assessments: current.assessments.map((item) => item.id === assessmentId ? { ...item, published: true } : item) }));
  }

  function createAssignment(input: Pick<Assignment, 'subjectId' | 'title' | 'description' | 'dueAt' | 'maxScore' | 'status'>) {
    teacherSubject(input.subjectId);
    if (!input.title.trim() || !input.description.trim() || !Number.isFinite(input.maxScore) || input.maxScore <= 0 || Number.isNaN(Date.parse(input.dueAt)) || Date.parse(input.dueAt) < Date.now()) throw new Error('Informe título, descrição, prazo futuro e pontuação válidos.');
    setData((current) => ({ ...current, assignments: [...current.assignments, { ...input, id: demoId(), title: input.title.trim(), description: input.description.trim(), publishedAt: input.status === 'PUBLISHED' ? new Date().toISOString() : undefined }] }));
  }

  function publishAssignment(assignmentId: string) {
    const assignment = data.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new Error('Atividade não encontrada.');
    teacherSubject(assignment.subjectId);
    if (Date.parse(assignment.dueAt) < Date.now()) throw new Error('O prazo já terminou.');
    setData((current) => ({ ...current, assignments: current.assignments.map((item) => item.id === assignmentId ? { ...item, status: 'PUBLISHED', publishedAt: new Date().toISOString() } : item) }));
  }

  function submitAssignment(assignmentId: string, fileName: string) {
    if (state.status !== 'signedIn' || state.user.perfil !== 'ALUNO') throw new Error('A entrega é exclusiva do estudante.');
    const assignment = data.assignments.find((item) => item.id === assignmentId);
    const subject = demoSubjects.find((item) => item.id === assignment?.subjectId);
    const previous = data.submissions.find((item) => item.assignmentId === assignmentId && item.studentId === demoStudentId);
    if (!assignment || !subject || !demoStudentSubjects.some((item) => item.id === subject.id) || !canSubmitAssignment(assignment, previous, Date.now())) throw new Error('Atividade indisponível para entrega.');
    if (!fileName.trim()) throw new Error('Selecione um arquivo para a entrega demonstrativa.');
    setData((current) => ({ ...current, submissions: [
      ...current.submissions.filter((item) => item.assignmentId !== assignmentId || item.studentId !== demoStudentId),
      { assignmentId, studentId: demoStudentId, fileName: fileName.trim(), submittedAt: new Date().toISOString() },
    ] }));
  }

  function gradeSubmission(assignmentId: string, studentId: string, score: number, feedback: string) {
    const assignment = data.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new Error('Atividade não encontrada.');
    const subject = teacherSubject(assignment.subjectId);
    if (!studentsInClass(subject.classId).some((item) => item.id === studentId) || !Number.isFinite(score) || score < 0 || score > assignment.maxScore) throw new Error('Nota ou vínculo inválido.');
    if (!data.submissions.some((item) => item.assignmentId === assignmentId && item.studentId === studentId)) throw new Error('Entrega não encontrada.');
    setData((current) => ({ ...current, submissions: current.submissions.map((item) => item.assignmentId === assignmentId && item.studentId === studentId ? { ...item, score, feedback: feedback.trim(), published: true, correctedAt: new Date().toISOString() } : item) }));
  }

  function createMaterial(input: Pick<Material, 'subjectId' | 'title' | 'description' | 'fileName'>) {
    teacherSubject(input.subjectId);
    if (!input.title.trim() || !input.fileName.trim()) throw new Error('Informe título e selecione um arquivo.');
    setData((current) => ({ ...current, materials: [...current.materials, { ...input, id: demoId(), title: input.title.trim(), fileName: input.fileName.trim(), publishedAt: new Date().toISOString() }] }));
  }

  return <AcademicDemoContext.Provider value={{ data, saveAttendance, createAssessment, saveGrades, publishAssessment, createAssignment, publishAssignment, submitAssignment, gradeSubmission, createMaterial }}>{children}</AcademicDemoContext.Provider>;
}

export function useAcademicDemo() {
  const context = useContext(AcademicDemoContext);
  if (!context) throw new Error('useAcademicDemo requer AcademicDemoProvider');
  return context;
}
