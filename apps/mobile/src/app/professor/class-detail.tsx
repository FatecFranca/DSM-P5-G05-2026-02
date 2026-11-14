import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoTeacherClassIds, subjectForClass } from '@/demo/academic';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { demoClasses, studentsInClass } from '@/demo/data';

export default function ProfessorClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const item = demoClasses.find((value) => value.id === id && demoTeacherClassIds.includes(value.id));
  if (!item) return <Screen><AcademicHeader title="Turma indisponível" back backHref="/professor/classes" /><EmptyState title="Vínculo não encontrado" detail="Esta turma não pertence aos vínculos docentes demonstrativos." /></Screen>;
  return <Screen><AcademicHeader title={item.name} subtitle={`${item.course} · ${item.semester}`} back backHref="/professor/classes" /><AcademicDemoNotice />
    <Panel><PanelTitle>Disciplinas</PanelTitle>{subjectForClass(item.id).map((subject) => <View key={subject.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{subject.title}</Text><Text style={academicStyles.meta}>Turma vinculada · semestre {subject.semester}</Text></View>)}</Panel>
    <Panel><PanelTitle>Estudantes matriculados</PanelTitle>{studentsInClass(item.id).map((student) => <View key={student.id} style={academicStyles.row}><Text style={academicStyles.strong}>{student.name}</Text><Text style={academicStyles.meta}>{student.registration}</Text></View>)}</Panel>
    <Panel><PanelTitle>Atalhos da turma</PanelTitle><View style={academicStyles.chips}><Pressable accessibilityRole="button" onPress={() => router.push('/professor/attendance')}><Text style={academicStyles.link}>Presença</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/professor/grades')}><Text style={academicStyles.link}>Avaliações</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/professor/materials')}><Text style={academicStyles.link}>Materiais</Text></Pressable></View></Panel>
  </Screen>;
}
