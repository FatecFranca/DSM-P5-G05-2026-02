import { Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';

export default function StudentNotifications() {
  const { data } = useAcademicDemo();
  const notices = [
    ...data.materials.filter((item) => demoStudentSubjects.some((subject) => subject.id === item.subjectId)).map((item) => ({ id: `material-${item.id}`, title: 'Novo material disponível', detail: item.title, date: item.publishedAt })),
    ...data.assignments.filter((item) => item.status === 'PUBLISHED' && item.publishedAt && demoStudentSubjects.some((subject) => subject.id === item.subjectId)).map((item) => ({ id: `assignment-${item.id}`, title: 'Atividade publicada', detail: item.title, date: item.publishedAt! })),
    ...data.submissions.filter((item) => item.studentId === demoStudentId && item.published && item.correctedAt).map((item) => ({ id: `feedback-${item.assignmentId}`, title: 'Feedback disponível', detail: data.assignments.find((assignment) => assignment.id === item.assignmentId)?.title ?? 'Atividade', date: item.correctedAt! })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return <Screen><AcademicHeader title="Notificações" subtitle="Avisos locais derivados dos dados demonstrativos." back backHref="/student" /><AcademicDemoNotice />
    {notices.length ? notices.map((notice) => <Panel key={notice.id}><PanelTitle>{notice.title}</PanelTitle><Text style={academicStyles.strong}>{notice.detail}</Text><Text style={academicStyles.meta}>{formatAcademicDate(notice.date)}</Text></Panel>) : <EmptyState title="Sem notificações" detail="Nenhum evento demonstrativo recente." />}
    <Text style={academicStyles.meta}>Notificações push dependem de infraestrutura e permissão configuradas. Nenhum push é enviado nesta demonstração.</Text>
  </Screen>;
}
