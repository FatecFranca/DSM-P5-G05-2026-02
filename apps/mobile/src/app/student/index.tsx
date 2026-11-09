import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ListRow, Panel, PanelHeader, PanelTitle, RowList, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { demoClasses, demoStudents } from '@/demo/data';

export default function StudentHome() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const { data } = useAcademicDemo();
  const student = demoStudents.find((item) => item.id === demoStudentId)!;
  const linkedClasses = demoClasses.filter((item) => demoStudentSubjects.some((subject) => subject.classId === item.id));
  const assignments = data.assignments.filter((item) => item.status === 'PUBLISHED' && demoStudentSubjects.some((subject) => subject.id === item.subjectId));
  const pending = assignments.filter((item) => Date.parse(item.dueAt) > now && !data.submissions.some((submission) => submission.assignmentId === item.id && submission.studentId === demoStudentId));

  return <Screen>
    <AcademicHeader title="Meu desempenho" subtitle={`${student.name} · acompanhamento acadêmico individual`} />
    <AcademicDemoNotice />
    <Panel>
      <PanelHeader title="Próximas entregas" actionLabel="Atividades" onAction={() => router.push('/student/assignments')} />
      {pending.length
        ? <RowList>{pending.map((assignment) => <ListRow
          key={assignment.id}
          title={assignment.title}
          meta={`${demoStudentSubjects.find((subject) => subject.id === assignment.subjectId)?.title ?? ''} · prazo ${formatAcademicDate(assignment.dueAt)}`}
          onPress={() => router.push({ pathname: '/student/assignment-detail', params: { id: assignment.id } })} />)}</RowList>
        : <Text style={academicStyles.meta}>Nenhuma entrega pendente.</Text>}
    </Panel>
    <Panel>
      <PanelHeader title="Disciplinas" actionLabel="Ver todas" onAction={() => router.push('/student/courses')} />
      {demoStudentSubjects.map((subject) => <Pressable key={subject.id} accessibilityRole="button" accessibilityLabel={`Abrir disciplina ${subject.title}`} onPress={() => router.push({ pathname: '/student/course-detail', params: { id: subject.id } })}><Panel><PanelTitle>{subject.title}</PanelTitle><Text style={academicStyles.meta}>{subject.course} · semestre {subject.semester}</Text><Text style={academicStyles.link}>Ver presença, faltas, notas e atividades →</Text></Panel></Pressable>)}
    </Panel>
    <Panel><PanelHeader title="Turmas vinculadas" /><RowList>{linkedClasses.map((item) => <ListRow key={item.id} title={item.name} meta={item.course} />)}</RowList></Panel>
    <Panel>
      <PanelHeader title="Materiais, agenda e avisos" />
      <RowList>
        <ListRow title="Materiais" meta="Arquivos publicados nas suas disciplinas" onPress={() => router.push('/student/materials')} />
        <ListRow title="Calendário acadêmico" onPress={() => router.push('/student/calendar')} />
        <ListRow title="Notificações locais" onPress={() => router.push('/student/notifications')} />
      </RowList>
    </Panel>
  </Screen>;
}
