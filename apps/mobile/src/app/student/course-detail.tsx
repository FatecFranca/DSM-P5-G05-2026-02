import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { attendanceSummary, demoStudentId, demoStudentSubjects, gradeAverage } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, Stat, academicStyles, formatAcademicNumber } from '@/demo/academic-ui';

export default function StudentCourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useAcademicDemo();
  const subject = demoStudentSubjects.find((item) => item.id === id);
  if (!subject) return <Screen><AcademicHeader title="Disciplina indisponível" back backHref="/student/courses" /><EmptyState title="Sem acesso" detail="Esta disciplina não pertence à matrícula demonstrativa." /></Screen>;
  const average = gradeAverage(data.assessments.filter((item) => item.subjectId === subject.id), data.grades, demoStudentId);
  const attendance = attendanceSummary(data.lessons.filter((item) => item.subjectId === subject.id), data.attendance, demoStudentId);
  return <Screen><AcademicHeader title={subject.title} subtitle={`${subject.course} · semestre ${subject.semester}`} back backHref="/student/courses" /><AcademicDemoNotice />
    <View style={academicStyles.grid}><Stat label="Média publicada" value={formatAcademicNumber(average)} /><Stat label="Presença registrada" value={attendance.percent === null ? '—' : `${Math.round(attendance.percent)}%`} /></View>
    <Panel><PanelTitle>Conteúdo disponível</PanelTitle><Text style={academicStyles.meta}>{data.assessments.filter((item) => item.subjectId === subject.id && item.published).length} avaliações publicadas · {data.assignments.filter((item) => item.subjectId === subject.id && item.status === 'PUBLISHED').length} atividades · {data.materials.filter((item) => item.subjectId === subject.id).length} materiais</Text><View style={academicStyles.chips}><Pressable accessibilityRole="button" onPress={() => router.push('/student/grades')}><Text style={academicStyles.link}>Notas</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/student/attendance')}><Text style={academicStyles.link}>Frequência</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/student/materials')}><Text style={academicStyles.link}>Materiais</Text></Pressable></View></Panel>
  </Screen>;
}
