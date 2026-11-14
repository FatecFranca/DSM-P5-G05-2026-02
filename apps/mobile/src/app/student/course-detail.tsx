import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { attendanceSummary, demoStudentId, demoStudentSubjects, gradeAverage } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, Stat, academicStyles, formatAcademicNumber } from '@/demo/academic-ui';

export default function StudentCourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useAcademicDemo();
  const [now] = useState(() => Date.now());
  const subject = demoStudentSubjects.find((item) => item.id === id);
  if (!subject) return <Screen><AcademicHeader title="Disciplina indisponível" back backHref="/student/courses" /><EmptyState title="Sem acesso" detail="Esta disciplina não pertence à matrícula demonstrativa." /></Screen>;
  const average = gradeAverage(data.assessments.filter((item) => item.subjectId === subject.id), data.grades, demoStudentId);
  const lessons = data.lessons.filter((item) => item.subjectId === subject.id);
  const attendance = attendanceSummary(lessons, data.attendance, demoStudentId);
  const assessments = data.assessments.filter((item) => item.subjectId === subject.id && item.published);
  const assignments = data.assignments.filter((item) => item.subjectId === subject.id && item.status !== 'DRAFT');
  return <Screen><AcademicHeader title={subject.title} subtitle={`${subject.course} · semestre ${subject.semester}`} back backHref="/student/courses" /><AcademicDemoNotice />
    <View style={academicStyles.grid}><Stat label="Média publicada" value={formatAcademicNumber(average)} /><Stat label="Presença registrada" value={attendance.percent === null ? '—' : `${Math.round(attendance.percent)}%`} /><Stat label="Presenças" value={String(attendance.present)} /><Stat label="Faltas" value={String(attendance.absent)} /><Stat label="Justificadas" value={String(attendance.justified)} /></View>
    <Panel><PanelTitle>Presença e faltas</PanelTitle>{lessons.length ? lessons.map((lesson) => { const record = data.attendance.find((item) => item.lessonId === lesson.id && item.studentId === demoStudentId); return <View key={lesson.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{lesson.topic}</Text><Text style={academicStyles.meta}>{new Date(lesson.date).toLocaleDateString('pt-BR')} · {record?.status === 'PRESENT' ? 'Presente' : record?.status === 'ABSENT' ? 'Falta' : record?.status === 'JUSTIFIED' ? 'Falta justificada' : 'Chamada não registrada'}</Text></View>; }) : <Text style={academicStyles.meta}>Nenhuma aula registrada.</Text>}</Panel>
    <Panel><PanelTitle>Notas</PanelTitle>{assessments.length ? assessments.map((assessment) => { const grade = data.grades.find((item) => item.assessmentId === assessment.id && item.studentId === demoStudentId); return <View key={assessment.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{assessment.title}</Text><Text style={academicStyles.meta}>{grade ? `${formatAcademicNumber(grade.score)} de ${formatAcademicNumber(assessment.maxScore)}` : 'Nota ainda não lançada'} · peso {assessment.weight}</Text></View>; }) : <Text style={academicStyles.meta}>Nenhuma avaliação publicada.</Text>}</Panel>
    <Panel><PanelTitle>Atividades</PanelTitle>{assignments.length ? assignments.map((assignment) => { const submission = data.submissions.find((item) => item.assignmentId === assignment.id && item.studentId === demoStudentId); return <Pressable key={assignment.id} accessibilityRole="button" accessibilityLabel={`Abrir atividade ${assignment.title}`} onPress={() => router.push({ pathname: '/student/assignment-detail', params: { id: assignment.id } })}><View style={academicStyles.stack}><Text style={academicStyles.strong}>{assignment.title}</Text><Text style={academicStyles.meta}>Prazo {new Date(assignment.dueAt).toLocaleDateString('pt-BR')} · {submission?.published ? 'Corrigida' : submission ? 'Entregue' : assignment.status === 'CLOSED' || Date.parse(assignment.dueAt) < now ? 'Prazo encerrado' : 'Pendente'}</Text><Text style={academicStyles.link}>Abrir atividade →</Text></View></Pressable>; }) : <Text style={academicStyles.meta}>Nenhuma atividade publicada.</Text>}</Panel>
  </Screen>;
}
