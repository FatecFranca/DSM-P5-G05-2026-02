import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentSubjects } from '@/demo/academic';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';

export default function StudentCourses() {
  const router = useRouter();
  return <Screen><AcademicHeader title="Minhas disciplinas" subtitle="Disciplinas da matrícula demonstrativa." back backHref="/student" /><AcademicDemoNotice />
    {demoStudentSubjects.length ? demoStudentSubjects.map((subject) => <Pressable key={subject.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/student/course-detail', params: { id: subject.id } })}><Panel><PanelTitle>{subject.title}</PanelTitle><Text style={academicStyles.meta}>{subject.course} · semestre {subject.semester}</Text><Text style={academicStyles.link}>Ver detalhes</Text></Panel></Pressable>) : <EmptyState title="Sem disciplinas" detail="A matrícula demonstrativa ainda não possui disciplinas." />}
  </Screen>;
}
