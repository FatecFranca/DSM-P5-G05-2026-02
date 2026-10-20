import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { Screen } from '@/components/primitives';
import { demoTeacherClassIds, demoTeacherSubjects } from '@/demo/academic';
import { AcademicDemoNotice, AcademicHeader, Chip, EmptyState, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { demoClasses, studentsInClass } from '@/demo/data';

export default function ProfessorClasses() {
  const router = useRouter();
  const [course, setCourse] = useState('Todos');
  const classes = demoClasses.filter((item) => demoTeacherClassIds.includes(item.id) && (course === 'Todos' || item.course === course));
  return <Screen><AcademicHeader title="Minhas turmas" subtitle="Apenas os vínculos docentes demonstrativos deste perfil." /><AcademicDemoNotice />
    <View style={academicStyles.chips}>{['Todos', 'ADS', 'DSM'].map((item) => <Chip key={item} label={item} selected={course === item} onPress={() => setCourse(item)} />)}</View>
    {classes.length ? classes.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir turma ${item.name}`} onPress={() => router.push({ pathname: '/professor/class-detail', params: { id: item.id } })}><Panel><View style={academicStyles.row}><PanelTitle>{item.name}</PanelTitle><Text style={academicStyles.link}>Abrir</Text></View><Text style={academicStyles.meta}>{item.course} · {item.semester} · {studentsInClass(item.id).length} estudantes</Text><Text style={academicStyles.meta}>{demoTeacherSubjects.filter((subject) => subject.classId === item.id).map((subject) => subject.title).join(' · ')}</Text></Panel></Pressable>) : <EmptyState title="Nenhuma turma neste curso" detail="Escolha outro filtro para ver seus vínculos demonstrativos." />}
  </Screen>;
}
