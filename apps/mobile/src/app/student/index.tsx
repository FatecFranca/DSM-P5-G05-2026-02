import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { attendanceSummary, demoStudentId, demoStudentSubjects, gradeAverage } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Panel, PanelTitle, Stat, academicStyles, formatAcademicDate, formatAcademicNumber } from '@/demo/academic-ui';
import { demoStudents } from '@/demo/data';
import { Bar } from '@/demo/ui';

export default function StudentHome() {
  const router = useRouter();
  const { data } = useAcademicDemo();
  const student = demoStudents.find((item) => item.id === demoStudentId)!;
  const ownAssessments = data.assessments.filter((item) => demoStudentSubjects.some((subject) => subject.id === item.subjectId) && item.published);
  const ownLessons = data.lessons.filter((item) => demoStudentSubjects.some((subject) => subject.id === item.subjectId));
  const attendance = attendanceSummary(ownLessons, data.attendance, demoStudentId);
  const overall = gradeAverage(ownAssessments, data.grades, demoStudentId);
  const assignments = data.assignments.filter((item) => item.status === 'PUBLISHED' && demoStudentSubjects.some((subject) => subject.id === item.subjectId));
  const pending = assignments.filter((item) => !data.submissions.some((submission) => submission.assignmentId === item.id && submission.studentId === demoStudentId));

  return <Screen><AcademicHeader title="Meu desempenho" subtitle={`${student.name} · acompanhamento acadêmico individual`} /><AcademicDemoNotice />
    <View style={academicStyles.grid}><Stat label="Média publicada" value={formatAcademicNumber(overall)} /><Stat label="Presença registrada" value={attendance.percent === null ? '—' : `${Math.round(attendance.percent)}%`} /><Stat label="Faltas registradas" value={String(attendance.absent)} /><Stat label="Atividades pendentes" value={String(pending.length)} /></View>
    <Panel><PanelTitle>Minhas disciplinas</PanelTitle>{demoStudentSubjects.map((subject) => <View key={subject.id} style={academicStyles.row}><View><Text style={academicStyles.strong}>{subject.title}</Text><Text style={academicStyles.meta}>{subject.course} · {subject.semester}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/student/course-detail', params: { id: subject.id } })}><Text style={academicStyles.link}>Detalhes</Text></Pressable></View>)}<Pressable accessibilityRole="button" onPress={() => router.push('/student/courses')}><Text style={academicStyles.link}>Ver todas as disciplinas</Text></Pressable></Panel>
    <Panel><PanelTitle>Médias publicadas por disciplina</PanelTitle>{demoStudentSubjects.map((subject) => { const average = gradeAverage(ownAssessments.filter((item) => item.subjectId === subject.id), data.grades, demoStudentId); return <Bar key={subject.id} label={subject.title} value={average === null ? 0 : average / 10} valueLabel={formatAcademicNumber(average)} />; })}<Text style={academicStyles.meta}>Escala demonstrativa de 0 a 10. A média real segue a configuração institucional.</Text></Panel>
    <Panel><PanelTitle>Presença por disciplina</PanelTitle>{demoStudentSubjects.map((subject) => { const result = attendanceSummary(data.lessons.filter((item) => item.subjectId === subject.id), data.attendance, demoStudentId); return <Bar key={subject.id} label={subject.title} value={result.percent === null ? 0 : result.percent / 100} />; })}</Panel>
    <Panel><PanelTitle>Próximas entregas</PanelTitle>{pending.length ? pending.map((assignment) => <View key={assignment.id} style={academicStyles.row}><View><Text style={academicStyles.strong}>{assignment.title}</Text><Text style={academicStyles.meta}>{formatAcademicDate(assignment.dueAt)}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/student/assignment-detail', params: { id: assignment.id } })}><Text style={academicStyles.link}>Abrir</Text></Pressable></View>) : <Text style={academicStyles.meta}>Nenhuma entrega pendente.</Text>}</Panel>
    <Panel><PanelTitle>Agenda e avisos</PanelTitle><View style={academicStyles.chips}><Pressable accessibilityRole="button" onPress={() => router.push('/student/calendar')}><Text style={academicStyles.link}>Calendário acadêmico</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/student/notifications')}><Text style={academicStyles.link}>Notificações locais</Text></Pressable></View></Panel>
  </Screen>;
}
