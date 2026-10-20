import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';

export default function StudentAssignments() {
  const router = useRouter();
  const { data } = useAcademicDemo();
  const [now] = useState(() => Date.now());
  const assignments = data.assignments.filter((item) => item.status === 'PUBLISHED' && demoStudentSubjects.some((subject) => subject.id === item.subjectId));
  return <Screen><AcademicHeader title="Minhas atividades" subtitle="Prazos, entregas e correções publicadas." /><AcademicDemoNotice />
    {assignments.length ? assignments.map((assignment) => {
      const subject = demoStudentSubjects.find((item) => item.id === assignment.subjectId)!;
      const submission = data.submissions.find((item) => item.assignmentId === assignment.id && item.studentId === demoStudentId);
      const status = submission?.published ? 'Corrigida' : submission ? 'Entregue' : Date.parse(assignment.dueAt) < now ? 'Prazo encerrado' : 'Pendente';
      return <Pressable key={assignment.id} accessibilityRole="button" accessibilityLabel={`Abrir ${assignment.title}`} onPress={() => router.push({ pathname: '/student/assignment-detail', params: { id: assignment.id } })}><Panel><View style={academicStyles.row}><PanelTitle>{assignment.title}</PanelTitle><Text style={academicStyles.link}>Abrir</Text></View><Text style={academicStyles.meta}>{subject.title} · prazo {formatAcademicDate(assignment.dueAt)}</Text><Text style={academicStyles.strong}>{status}</Text></Panel></Pressable>;
    }) : <EmptyState title="Sem atividades" detail="Nenhuma atividade publicada para as disciplinas demonstrativas." />}
  </Screen>;
}
