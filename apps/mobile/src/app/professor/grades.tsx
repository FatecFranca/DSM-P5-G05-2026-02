import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { demoScale, demoTeacherSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ActionButton, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { studentsInClass } from '@/demo/data';

export default function ProfessorGrades() {
  const { state } = useSession();
  const { data, createAssessment, saveGrades, publishAssessment } = useAcademicDemo();
  const [subjectId, setSubjectId] = useState(demoTeacherSubjects[0].id);
  const [assessmentId, setAssessmentId] = useState(`${demoTeacherSubjects[0].id}-avaliacao-2`);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState('1');
  const [maxScore, setMaxScore] = useState(String(demoScale));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState('');
  const subject = demoTeacherSubjects.find((item) => item.id === subjectId)!;
  const assessments = data.assessments.filter((item) => item.subjectId === subjectId);
  const selected = assessments.find((item) => item.id === assessmentId) ?? assessments[0];
  const students = studentsInClass(subject.classId);
  const canEdit = state.status === 'signedIn' && state.user.perfil === 'PROFESSOR';

  function addAssessment() {
    try {
      createAssessment({ subjectId, title, weight: Number(weight.replace(',', '.')), maxScore: Number(maxScore.replace(',', '.')), date: new Date(`${date}T12:00:00`).toISOString() });
      setTitle(''); setFeedback('Avaliação demonstrativa criada como rascunho.');
    } catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível criar.'); }
  }

  function save() {
    if (!selected) return;
    const scores: Record<string, number> = {};
    for (const [id, text] of Object.entries(draftScores)) {
      if (!text.trim()) continue;
      const score = Number(text.replace(',', '.'));
      if (!Number.isFinite(score)) { setFeedback('Confira as notas informadas.'); return; }
      scores[id] = score;
    }
    if (!Object.keys(scores).length) { setFeedback('Altere ao menos uma nota antes de salvar.'); return; }
    try { saveGrades(selected.id, scores); setDraftScores({}); setFeedback('Notas demonstrativas salvas neste dispositivo.'); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  }

  function publish() {
    if (!selected) return;
    try { publishAssessment(selected.id); setFeedback('Resultados demonstrativos publicados para o aluno.'); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível publicar.'); }
  }

  return <Screen><AcademicHeader title="Lançamento de notas" subtitle="Avaliações, pesos e resultados da turma vinculada." /><AcademicDemoNotice />
    <Panel><PanelTitle>Disciplina</PanelTitle><View style={academicStyles.chips}>{demoTeacherSubjects.map((item) => <Chip key={item.id} label={item.title} selected={subjectId === item.id} onPress={() => { setSubjectId(item.id); setAssessmentId(`${item.id}-avaliacao-2`); setDraftScores({}); setFeedback(''); }} />)}</View></Panel>
    <Panel><PanelTitle>Avaliações</PanelTitle><View style={academicStyles.chips}>{assessments.map((item) => <Chip key={item.id} label={`${item.title}${item.published ? ' · publicada' : ' · rascunho'}`} selected={selected?.id === item.id} onPress={() => { setAssessmentId(item.id); setDraftScores({}); setFeedback(''); }} />)}</View>
      {selected ? <Text style={academicStyles.meta}>Peso {selected.weight} · nota máxima {selected.maxScore} · {formatAcademicDate(selected.date)}</Text> : null}</Panel>
    {selected ? <Panel><PanelTitle>Notas da turma</PanelTitle><Text style={academicStyles.meta}>Escala demonstrativa de 0 a {selected.maxScore}. A escala e o fechamento reais vêm do backend.</Text>
      {students.map((student) => {
        const existing = data.grades.find((item) => item.assessmentId === selected.id && item.studentId === student.id);
        return <View key={student.id} style={academicStyles.stack}><View style={academicStyles.row}><Text style={academicStyles.strong}>{student.name}</Text><Text style={academicStyles.meta}>{student.registration}</Text></View>{canEdit ? <FormField label={`Nota de ${student.name}`} keyboardType="decimal-pad" value={draftScores[student.id] ?? (existing ? String(existing.score) : '')} onChangeText={(text) => setDraftScores((current) => ({ ...current, [student.id]: text }))} placeholder="Sem nota" /> : <Text style={academicStyles.meta}>Nota: {existing ? existing.score : 'não lançada'}</Text>}<View style={academicStyles.divider} /></View>;
      })}
      {canEdit ? <View style={academicStyles.chips}><ActionButton title="Salvar notas" onPress={save} /><ActionButton title="Publicar resultados" secondary onPress={publish} disabled={selected.published} /></View> : <Text style={academicStyles.meta}>Tutoria: consulta somente leitura.</Text>}
      {feedback ? <Feedback message={feedback} error={!feedback.includes('demonstrativ')} /> : null}
    </Panel> : null}
    {canEdit ? <Panel><PanelTitle>Criar avaliação</PanelTitle><FormField label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: Projeto prático" /><View style={academicStyles.grid}><FormField label="Peso relativo" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /><FormField label="Nota máxima" value={maxScore} onChangeText={setMaxScore} keyboardType="decimal-pad" /></View><FormField label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} /><ActionButton title="Criar rascunho" onPress={addAssessment} /></Panel> : null}
  </Screen>;
}
