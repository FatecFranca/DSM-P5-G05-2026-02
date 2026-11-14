import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { demoScale, demoTeacherSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ActionButton, Chip, EmptyState, Feedback, FormField, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { demoStudents } from '@/demo/data';

export default function ProfessorAssignments() {
  const { state } = useSession();
  const { data, createAssignment, publishAssignment, gradeSubmission } = useAcademicDemo();
  const [subjectId, setSubjectId] = useState(demoTeacherSubjects[0].id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(String(demoScale));
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [correction, setCorrection] = useState('');
  const [feedback, setFeedback] = useState('');
  const canEdit = state.status === 'signedIn' && state.user.perfil === 'PROFESSOR';
  const assignments = data.assignments.filter((item) => item.subjectId === subjectId);
  const submissions = data.submissions.filter((item) => assignments.some((assignment) => assignment.id === item.assignmentId));

  function create(status: 'DRAFT' | 'PUBLISHED') {
    try {
      createAssignment({ subjectId, title, description, dueAt: new Date(`${dueDate}T23:59:00`).toISOString(), maxScore: Number(maxScore.replace(',', '.')), status });
      setTitle(''); setDescription(''); setFeedback(status === 'DRAFT' ? 'Rascunho demonstrativo criado.' : 'Atividade demonstrativa publicada.');
    } catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível criar a atividade.'); }
  }

  function correct() {
    const submission = submissions.find((item) => `${item.assignmentId}:${item.studentId}` === selectedSubmission);
    if (!submission) return;
    try { gradeSubmission(submission.assignmentId, submission.studentId, Number(score.replace(',', '.')), correction); setFeedback('Correção demonstrativa publicada.'); setSelectedSubmission(null); setScore(''); setCorrection(''); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível corrigir.'); }
  }

  return <Screen><AcademicHeader title="Atividades e trabalhos" subtitle="Criação, entregas e correção no recorte das suas disciplinas." back backHref="/professor" /><AcademicDemoNotice />
    <Panel><PanelTitle>Disciplina</PanelTitle><View style={academicStyles.chips}>{demoTeacherSubjects.map((subject) => <Chip key={subject.id} label={subject.title} selected={subjectId === subject.id} onPress={() => { setSubjectId(subject.id); setSelectedSubmission(null); }} />)}</View></Panel>
    {assignments.length ? assignments.map((assignment) => <Panel key={assignment.id}><View style={academicStyles.row}><PanelTitle>{assignment.title}</PanelTitle><Text style={academicStyles.meta}>{assignment.status === 'PUBLISHED' ? 'Publicada' : assignment.status === 'DRAFT' ? 'Rascunho' : 'Encerrada'}</Text></View><Text style={academicStyles.meta}>{assignment.description}</Text><Text style={academicStyles.meta}>Prazo {formatAcademicDate(assignment.dueAt)} · nota máxima {assignment.maxScore} · {data.submissions.filter((item) => item.assignmentId === assignment.id).length} entregas</Text>{canEdit && assignment.status === 'DRAFT' ? <ActionButton title="Publicar atividade" secondary onPress={() => { try { publishAssignment(assignment.id); setFeedback('Atividade demonstrativa publicada.'); } catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível publicar.'); } }} /> : null}</Panel>) : <EmptyState title="Sem atividades" detail="Crie uma atividade para esta disciplina." />}
    <Panel><PanelTitle>Entregas para corrigir</PanelTitle>{submissions.length ? submissions.map((submission) => {
      const student = demoStudents.find((item) => item.id === submission.studentId);
      const assignment = assignments.find((item) => item.id === submission.assignmentId);
      return <View key={`${submission.assignmentId}:${submission.studentId}`} style={academicStyles.stack}><Text style={academicStyles.strong}>{student?.name} · {assignment?.title}</Text><Text style={academicStyles.meta}>{submission.fileName} · enviado em {formatAcademicDate(submission.submittedAt)} · {submission.published ? `corrigido: ${submission.score}` : 'aguardando correção'}</Text>{canEdit ? <ActionButton title="Corrigir entrega" secondary onPress={() => { setSelectedSubmission(`${submission.assignmentId}:${submission.studentId}`); setScore(submission.score === undefined ? '' : String(submission.score)); setCorrection(submission.feedback ?? ''); }} /> : null}<View style={academicStyles.divider} /></View>;
    }) : <Text style={academicStyles.meta}>Nenhuma entrega registrada neste dispositivo.</Text>}
      {selectedSubmission && canEdit ? <View style={academicStyles.stack}><FormField label="Nota da entrega" value={score} onChangeText={setScore} keyboardType="decimal-pad" /><FormField label="Feedback" value={correction} onChangeText={setCorrection} multiline /><ActionButton title="Publicar correção" onPress={correct} /></View> : null}
    </Panel>
    {canEdit ? <Panel><PanelTitle>Criar atividade</PanelTitle><FormField label="Título" value={title} onChangeText={setTitle} /><FormField label="Descrição" value={description} onChangeText={setDescription} multiline /><FormField label="Prazo (AAAA-MM-DD)" value={dueDate} onChangeText={setDueDate} /><FormField label="Pontuação máxima" value={maxScore} onChangeText={setMaxScore} keyboardType="decimal-pad" /><View style={academicStyles.chips}><ActionButton title="Salvar rascunho" secondary onPress={() => create('DRAFT')} /><ActionButton title="Publicar atividade" onPress={() => create('PUBLISHED')} /></View></Panel> : null}
    {feedback ? <Feedback message={feedback} error={!feedback.includes('demonstrativ')} /> : null}
  </Screen>;
}
