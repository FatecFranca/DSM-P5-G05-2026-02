import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Panel, PanelTitle, Stat, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { demoClasses, demoStudents } from '@/demo/data';

export default function StudentHome() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const { data } = useAcademicDemo();
  const student = demoStudents.find((item) => item.id === demoStudentId)!;
  const linkedClasses = demoClasses.filter((item) => demoStudentSubjects.some((subject) => subject.classId === item.id));
  const assignments = data.assignments.filter((item) => item.status === 'PUBLISHED' && demoStudentSubjects.some((subject) => subject.id === item.subjectId));
  const pending = assignments.filter((item) => Date.parse(item.dueAt) > now && !data.submissions.some((submission) => submission.assignmentId === item.id && submission.studentId === demoStudentId));

  return <Screen><AcademicHeader title="Meu desempenho" subtitle={`${student.name} · acompanhamento acadêmico individual`} /><AcademicDemoNotice />
    <View style={academicStyles.grid}><Stat label="Turmas vinculadas" value={String(linkedClasses.length)} /><Stat label="Atividades pendentes" value={String(pending.length)} /></View>
    <Panel><PanelTitle>Turmas vinculadas</PanelTitle>{linkedClasses.map((item) => <Text key={item.id} style={academicStyles.meta}>{item.name} · {item.course}</Text>)}</Panel>
    <Text style={academicStyles.strong}>Minhas disciplinas</Text>
    {demoStudentSubjects.map((subject) => <Pressable key={subject.id} accessibilityRole="button" accessibilityLabel={`Abrir ${subject.title}`} onPress={() => router.push({ pathname: '/student/course-detail', params: { id: subject.id } })}>
      <Panel><View style={academicStyles.row}><View style={{ flex: 1, gap: 4 }}><PanelTitle>{subject.title}</PanelTitle><Text style={academicStyles.meta}>{subject.course} · {subject.semester}</Text></View><Text style={academicStyles.link}>Abrir →</Text></View></Panel>
    </Pressable>)}
    <Panel><PanelTitle>Atividades pendentes</PanelTitle>{pending.length ? pending.map((assignment) => <View key={assignment.id} style={academicStyles.row}><View><Text style={academicStyles.strong}>{assignment.title}</Text><Text style={academicStyles.meta}>Prazo {formatAcademicDate(assignment.dueAt)}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/student/assignment-detail', params: { id: assignment.id } })}><Text style={academicStyles.link}>Abrir</Text></Pressable></View>) : <Text style={academicStyles.meta}>Nenhuma atividade pendente.</Text>}</Panel>
    <Panel><PanelTitle>Agenda e avisos</PanelTitle><View style={academicStyles.chips}><Pressable accessibilityRole="button" onPress={() => router.push('/student/calendar')}><Text style={academicStyles.link}>Calendário acadêmico</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/student/notifications')}><Text style={academicStyles.link}>Notificações locais</Text></Pressable></View></Panel>
  </Screen>;
}
