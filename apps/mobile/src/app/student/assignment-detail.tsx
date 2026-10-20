import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { canSubmitAssignment, demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ActionButton, EmptyState, Feedback, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { pickDemoDocument } from '@/demo/document';

export default function StudentAssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, submitAssignment } = useAcademicDemo();
  const [fileName, setFileName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [now] = useState(() => Date.now());
  const assignment = data.assignments.find((item) => item.id === id && item.status === 'PUBLISHED' && demoStudentSubjects.some((subject) => subject.id === item.subjectId));
  if (!assignment) return <Screen><AcademicHeader title="Atividade indisponível" back backHref="/student/assignments" /><EmptyState title="Acesso não disponível" detail="Atividade não publicada ou fora da matrícula demonstrativa." /></Screen>;
  const assignmentId = assignment.id;
  const subject = demoStudentSubjects.find((item) => item.id === assignment.subjectId)!;
  const submission = data.submissions.find((item) => item.assignmentId === assignment.id && item.studentId === demoStudentId);
  const canSubmit = canSubmitAssignment(assignment, submission, now);

  async function choose() {
    try { const selected = await pickDemoDocument(); if (selected) setFileName(selected); }
    catch { setFeedback('Não foi possível selecionar o documento.'); }
  }

  function submit() {
    try { submitAssignment(assignmentId, fileName); setFeedback('Entrega demonstrativa registrada neste dispositivo.'); setFileName(''); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível entregar.'); }
  }

  return <Screen><AcademicHeader title={assignment.title} subtitle={subject.title} back backHref="/student/assignments" /><AcademicDemoNotice />
    <Panel><PanelTitle>Instruções</PanelTitle><Text style={academicStyles.meta}>{assignment.description}</Text><Text style={academicStyles.strong}>Prazo: {formatAcademicDate(assignment.dueAt)}</Text><Text style={academicStyles.meta}>Pontuação máxima: {assignment.maxScore}</Text></Panel>
    {submission ? <Panel><PanelTitle>Minha entrega</PanelTitle><Text style={academicStyles.meta}>{submission.fileName} · {formatAcademicDate(submission.submittedAt)}</Text>{submission.published ? <><Text style={academicStyles.strong}>Nota: {submission.score} / {assignment.maxScore}</Text><Text style={academicStyles.meta}>Feedback: {submission.feedback || 'Sem comentário.'}</Text></> : <Text style={academicStyles.meta}>Aguardando correção do professor.</Text>}</Panel> : null}
    <Panel><PanelTitle>{submission ? 'Substituir entrega' : 'Entregar trabalho'}</PanelTitle>{canSubmit ? <><ActionButton title="Selecionar PDF, DOCX, PPTX ou ODT" secondary onPress={() => void choose()} /><Text style={academicStyles.meta}>{fileName || 'Nenhum arquivo selecionado'}</Text><ActionButton title="Registrar entrega no demo" onPress={submit} disabled={!fileName} /><Text style={academicStyles.meta}>Somente o nome do arquivo é guardado em memória. Não há upload para servidor nesta demonstração.</Text></> : <Text style={academicStyles.meta}>{submission?.published ? 'A entrega corrigida não pode ser substituída.' : 'O prazo terminou. A demonstração não permite novas entregas.'}</Text>}{feedback ? <Feedback message={feedback} error={!feedback.includes('demonstrativa')} /> : null}</Panel>
  </Screen>;
}
