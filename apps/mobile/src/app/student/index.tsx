import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { attendanceSummary, demoStudentId, demoStudentSubjects, gradeAverage } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ListRow, Panel, PanelHeader, RowList, StatStrip, academicStyles, formatAcademicDate, formatAcademicNumber } from '@/demo/academic-ui';
import { demoStudents } from '@/demo/data';

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
    <StatStrip items={[
      { label: 'Média publicada', value: formatAcademicNumber(overall) },
      { label: 'Presença registrada', value: attendance.percent === null ? '—' : `${Math.round(attendance.percent)}%` },
      { label: 'Faltas registradas', value: String(attendance.absent) },
    ]} />
    <Panel>
      <PanelHeader title="Disciplinas" actionLabel="Ver todas" onAction={() => router.push('/student/courses')} />
      <RowList>{demoStudentSubjects.map((subject) => {
        const average = gradeAverage(ownAssessments.filter((item) => item.subjectId === subject.id), data.grades, demoStudentId);
        const presence = attendanceSummary(data.lessons.filter((item) => item.subjectId === subject.id), data.attendance, demoStudentId).percent;
        return <ListRow
          key={subject.id}
          title={subject.title}
          meta={`${subject.course} · ${subject.semester} · presença ${presence === null ? '—' : `${Math.round(presence)}%`}`}
          value={formatAcademicNumber(average)}
          onPress={() => router.push({ pathname: '/student/course-detail', params: { id: subject.id } })} />;
      })}</RowList>
      <Text style={academicStyles.meta}>Média por disciplina na escala demonstrativa de 0 a 10. A média real segue a configuração institucional.</Text>
    </Panel>
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
