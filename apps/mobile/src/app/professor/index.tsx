import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { demoReferenceTime, demoTeacherClassIds, demoTeacherSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Panel, PanelTitle, Stat, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { demoClasses, studentsInClass } from '@/demo/data';

export default function ProfessorHome() {
  const router = useRouter();
  const { state } = useSession();
  const { data } = useAcademicDemo();
  const pendingCalls = data.lessons.filter((lesson) => Date.parse(lesson.date) <= demoReferenceTime && demoTeacherSubjects.some((subject) => subject.id === lesson.subjectId) && !data.attendance.some((record) => record.lessonId === lesson.id)).length;
  const pendingGrades = data.assessments.filter((assessment) => demoTeacherSubjects.some((subject) => subject.id === assessment.subjectId) && !assessment.published).length;
  const pendingCorrections = data.submissions.filter((submission) => !submission.published && data.assignments.some((assignment) => assignment.id === submission.assignmentId && demoTeacherSubjects.some((subject) => subject.id === assignment.subjectId))).length;
  const studentCount = demoTeacherClassIds.reduce((sum, id) => sum + studentsInClass(id).length, 0);
  const readOnly = state.status === 'signedIn' && state.user.perfil === 'TUTOR';

  return <Screen>
    <AcademicHeader title={readOnly ? 'Acompanhamento' : 'Painel do professor'} subtitle={readOnly ? 'Visão de leitura demonstrativa. Lançamentos são exclusivos do docente.' : 'Suas turmas e tarefas acadêmicas em um só lugar.'} />
    <AcademicDemoNotice />
    <View style={academicStyles.grid}><Stat label="Turmas vinculadas" value={String(demoTeacherClassIds.length)} /><Stat label="Estudantes nas turmas" value={String(studentCount)} /><Stat label="Chamadas pendentes" value={String(pendingCalls)} /><Stat label="Avaliações não publicadas" value={String(pendingGrades)} /></View>
    <Panel><PanelTitle>Próximas aulas</PanelTitle>{data.lessons.filter((lesson) => lesson.id.endsWith('3') && demoTeacherSubjects.some((subject) => subject.id === lesson.subjectId)).slice(0, 3).map((lesson) => {
      const subject = demoTeacherSubjects.find((item) => item.id === lesson.subjectId)!;
      return <View key={lesson.id} style={academicStyles.row}><View><Text style={academicStyles.strong}>{subject.title}</Text><Text style={academicStyles.meta}>{formatAcademicDate(lesson.date)} · {lesson.topic}</Text></View><Text style={academicStyles.meta}>{demoClasses.find((item) => item.id === subject.classId)?.name}</Text></View>;
    })}</Panel>
    <Panel><PanelTitle>Acesso rápido</PanelTitle><View style={academicStyles.chips}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/professor/classes')}><Text style={academicStyles.link}>Minhas turmas</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/professor/attendance')}><Text style={academicStyles.link}>Registrar chamada</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/professor/grades')}><Text style={academicStyles.link}>Lançar notas</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/professor/assignments')}><Text style={academicStyles.link}>Atividades ({pendingCorrections} para corrigir)</Text></Pressable>
    </View></Panel>
    <Panel><PanelTitle>Avisos acadêmicos</PanelTitle><Text style={academicStyles.meta}>Nesta demonstração, prazos, vínculos e permissões institucionais são ilustrativos. Os avisos reais dependem da API.</Text></Panel>
  </Screen>;
}
