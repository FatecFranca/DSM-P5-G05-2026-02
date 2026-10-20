import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { demoTeacherSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ActionButton, Chip, EmptyState, Feedback, FormField, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { pickDemoDocument } from '@/demo/document';

export default function ProfessorMaterials() {
  const { state } = useSession();
  const { data, createMaterial } = useAcademicDemo();
  const [subjectId, setSubjectId] = useState(demoTeacherSubjects[0].id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [feedback, setFeedback] = useState('');
  const canEdit = state.status === 'signedIn' && state.user.perfil === 'PROFESSOR';
  const materials = data.materials.filter((item) => item.subjectId === subjectId);

  async function chooseFile() {
    try { const selected = await pickDemoDocument(); if (selected) setFileName(selected); }
    catch { setFeedback('Não foi possível selecionar o documento.'); }
  }

  function publish() {
    try { createMaterial({ subjectId, title, description, fileName }); setTitle(''); setDescription(''); setFileName(''); setFeedback('Material demonstrativo publicado neste dispositivo.'); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível publicar.'); }
  }

  return <Screen><AcademicHeader title="Materiais de aula" subtitle="Arquivos das disciplinas vinculadas ao docente." /><AcademicDemoNotice />
    <Panel><PanelTitle>Disciplina</PanelTitle><View style={academicStyles.chips}>{demoTeacherSubjects.map((subject) => <Chip key={subject.id} label={subject.title} selected={subjectId === subject.id} onPress={() => setSubjectId(subject.id)} />)}</View></Panel>
    {materials.length ? materials.map((material) => <Panel key={material.id}><PanelTitle>{material.title}</PanelTitle><Text style={academicStyles.meta}>{material.description}</Text><Text style={academicStyles.meta}>{material.fileName} · {formatAcademicDate(material.publishedAt)}</Text><Text style={academicStyles.meta}>Arquivo demonstrativo. A abertura e o download dependem do armazenamento privado da API.</Text></Panel>) : <EmptyState title="Sem materiais" detail="Nenhum material publicado para esta disciplina." />}
    {canEdit ? <Panel><PanelTitle>Publicar material</PanelTitle><FormField label="Título" value={title} onChangeText={setTitle} /><FormField label="Descrição" value={description} onChangeText={setDescription} multiline /><ActionButton title="Selecionar PDF, DOCX, PPTX ou ODT" secondary onPress={() => void chooseFile()} /><Text style={academicStyles.meta}>{fileName || 'Nenhum arquivo selecionado'}</Text><ActionButton title="Publicar neste demo" onPress={publish} /><Text style={academicStyles.meta}>Somente o nome é guardado em memória; o arquivo não é enviado.</Text></Panel> : <Text style={academicStyles.meta}>Tutoria: consulta somente leitura.</Text>}
    {feedback ? <Feedback message={feedback} error={!feedback.includes('demonstrativ')} /> : null}
  </Screen>;
}
