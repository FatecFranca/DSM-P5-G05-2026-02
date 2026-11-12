import { useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { demoReferenceTime, demoTeacherClassIds, demoTeacherSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ListRow, Panel, PanelHeader, RowList, formatAcademicDate, pendingBadge } from '@/demo/academic-ui';
import { demoClasses, studentsInClass } from '@/demo/data';

export default function ProfessorHome() {
  const router = useRouter();
  const { state } = useSession();
  const { data } = useAcademicDemo();
  const pendingCalls = data.lessons.filter((lesson) => Date.parse(lesson.date) <= demoReferenceTime && demoTeacherSubjects.some((subject) => subject.id === lesson.subjectId) && !data.attendance.some((record) => record.lessonId === lesson.id)).length;
  const pendingGrades = data.assessments.filter((assessment) => demoTeacherSubjects.some((subject) => subject.id === assessment.subjectId) && !assessment.published).length;
  const pendingCorrections = data.submissions.filter((submission) => !submission.published && data.assignments.some((assignment) => assignment.id === submission.assignmentId && demoTeacherSubjects.some((subject) => subject.id === assignment.subjectId))).length;
  const studentCount = demoTeacherClassIds.reduce((sum, id) => sum + studentsInClass(id).length, 0);
  const classCount = demoTeacherClassIds.length;
  const readOnly = state.status === 'signedIn' && state.user.perfil === 'TUTOR';
  const upcoming = data.lessons.filter((lesson) => lesson.id.endsWith('3') && demoTeacherSubjects.some((subject) => subject.id === lesson.subjectId)).slice(0, 3);

  return <Screen>
    <AcademicHeader
      title={readOnly ? 'Acompanhamento' : 'Painel do professor'}
      subtitle={readOnly ? 'Visão de leitura demonstrativa. Lançamentos são exclusivos do docente.' : `${classCount} ${classCount === 1 ? 'turma' : 'turmas'} · ${studentCount} estudantes`} />
    <AcademicDemoNotice />
    <Panel>
      <PanelHeader title="Pendências" />
      <RowList>
        <ListRow title="Chamadas pendentes" meta="Aulas já realizadas sem registro de presença" badge={pendingBadge(pendingCalls)} onPress={() => router.push('/professor/attendance')} />
        <ListRow title="Avaliações não publicadas" meta="Notas ainda não publicadas aos estudantes" badge={pendingBadge(pendingGrades)} onPress={() => router.push('/professor/grades')} />
        <ListRow title="Entregas para corrigir" meta="Atividades enviadas aguardando correção" badge={pendingBadge(pendingCorrections)} onPress={() => router.push('/professor/assignments')} />
      </RowList>
    </Panel>
    <Panel>
      <RowList><ListRow title="Materiais" meta="Arquivos publicados para as turmas" onPress={() => router.push('/professor/materials')} /></RowList>
    </Panel>
    <Panel>
      <PanelHeader title="Próximas aulas" actionLabel="Turmas" onAction={() => router.push('/professor/classes')} />
      {upcoming.length ? <RowList>{upcoming.map((lesson) => {
        const subject = demoTeacherSubjects.find((item) => item.id === lesson.subjectId)!;
        return <ListRow key={lesson.id} title={subject.title} meta={`${formatAcademicDate(lesson.date)} · ${lesson.topic}`} badge={{ text: demoClasses.find((item) => item.id === subject.classId)?.name ?? '', tone: 'neutral' }} />;
      })}</RowList> : null}
    </Panel>
  </Screen>;
}
