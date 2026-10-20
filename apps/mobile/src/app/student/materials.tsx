import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Chip, EmptyState, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';

export default function StudentMaterials() {
  const { data } = useAcademicDemo();
  const [subjectId, setSubjectId] = useState('all');
  const materials = data.materials.filter((item) => demoStudentSubjects.some((subject) => subject.id === item.subjectId) && (subjectId === 'all' || subjectId === item.subjectId));
  return <Screen><AcademicHeader title="Materiais de aula" subtitle="Publicações das disciplinas da matrícula demonstrativa." /><AcademicDemoNotice />
    <View style={academicStyles.chips}><Chip label="Todos" selected={subjectId === 'all'} onPress={() => setSubjectId('all')} />{demoStudentSubjects.map((subject) => <Chip key={subject.id} label={subject.title} selected={subjectId === subject.id} onPress={() => setSubjectId(subject.id)} />)}</View>
    {materials.length ? materials.map((material) => <Panel key={material.id}><PanelTitle>{material.title}</PanelTitle><Text style={academicStyles.meta}>{demoStudentSubjects.find((subject) => subject.id === material.subjectId)?.title}</Text><Text style={academicStyles.meta}>{material.description}</Text><Text style={academicStyles.strong}>{material.fileName}</Text><Text style={academicStyles.meta}>Publicado em {formatAcademicDate(material.publishedAt)}. Arquivo demonstrativo sem download; o acesso real dependerá da API autorizada.</Text></Panel>) : <EmptyState title="Nenhum material" detail="Escolha outra disciplina ou aguarde novas publicações." />}
  </Screen>;
}
