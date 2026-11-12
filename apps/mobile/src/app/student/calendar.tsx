import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Chip, EmptyState, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';

export default function StudentCalendar() {
  const { data } = useAcademicDemo();
  const [subjectId, setSubjectId] = useState('all');
  const events = [
    ...data.lessons.filter((lesson) => demoStudentSubjects.some((subject) => subject.id === lesson.subjectId)).map((lesson) => ({ id: lesson.id, subjectId: lesson.subjectId, date: lesson.date, title: lesson.topic, kind: 'Aula' })),
    ...data.assignments.filter((assignment) => assignment.status === 'PUBLISHED' && demoStudentSubjects.some((subject) => subject.id === assignment.subjectId)).map((assignment) => ({ id: assignment.id, subjectId: assignment.subjectId, date: assignment.dueAt, title: assignment.title, kind: 'Entrega' })),
    ...data.assessments.filter((assessment) => assessment.published && demoStudentSubjects.some((subject) => subject.id === assessment.subjectId)).map((assessment) => ({ id: assessment.id, subjectId: assessment.subjectId, date: assessment.date, title: assessment.title, kind: 'Avaliação' })),
  ].filter((event) => subjectId === 'all' || event.subjectId === subjectId).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return <Screen><AcademicHeader title="Calendário acadêmico" subtitle="Aulas, avaliações publicadas e prazos demonstrativos." back backHref="/student" /><AcademicDemoNotice />
    <View style={academicStyles.chips}><Chip label="Todos" selected={subjectId === 'all'} onPress={() => setSubjectId('all')} />{demoStudentSubjects.map((subject) => <Chip key={subject.id} label={subject.title} selected={subjectId === subject.id} onPress={() => setSubjectId(subject.id)} />)}</View>
    {events.length ? events.map((event) => <Panel key={`${event.kind}-${event.id}`}><View style={academicStyles.row}><PanelTitle>{event.title}</PanelTitle><Text style={academicStyles.meta}>{event.kind}</Text></View><Text style={academicStyles.meta}>{formatAcademicDate(event.date)} · {demoStudentSubjects.find((subject) => subject.id === event.subjectId)?.title}</Text></Panel>) : <EmptyState title="Sem eventos" detail="Escolha outra disciplina para consultar as datas." />}
  </Screen>;
}
