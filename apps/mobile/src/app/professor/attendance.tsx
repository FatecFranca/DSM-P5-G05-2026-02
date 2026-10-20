import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { demoTeacherSubjects, type AttendanceStatus } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, ActionButton, Chip, Feedback, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { studentsInClass } from '@/demo/data';

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Presente' }, { value: 'ABSENT', label: 'Falta' }, { value: 'JUSTIFIED', label: 'Justificada' },
];

export default function ProfessorAttendance() {
  const { state } = useSession();
  const { data, saveAttendance } = useAcademicDemo();
  const [subjectId, setSubjectId] = useState(demoTeacherSubjects[0].id);
  const [lessonId, setLessonId] = useState(`${demoTeacherSubjects[0].id}-aula-3`);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [feedback, setFeedback] = useState('');
  const subject = demoTeacherSubjects.find((item) => item.id === subjectId)!;
  const lessons = data.lessons.filter((item) => item.subjectId === subjectId);
  const students = studentsInClass(subject.classId);
  const canEdit = state.status === 'signedIn' && state.user.perfil === 'PROFESSOR';
  const valueFor = (id: string) => draft[id] ?? data.attendance.find((item) => item.lessonId === lessonId && item.studentId === id)?.status;
  const counts = { PRESENT: 0, ABSENT: 0, JUSTIFIED: 0 };
  students.forEach((student) => { const value = valueFor(student.id); if (value) counts[value]++; });

  function save() {
    const statuses: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      const value = valueFor(student.id);
      if (!value) { setFeedback('Marque todos os estudantes antes de salvar a chamada.'); return; }
      statuses[student.id] = value;
    }
    try { saveAttendance(lessonId, statuses); setDraft({}); setFeedback('Chamada demonstrativa salva neste dispositivo.'); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  }

  return <Screen><AcademicHeader title="Registro de presença" subtitle="Selecione disciplina e aula antes de marcar cada estudante." /><AcademicDemoNotice />
    <Panel><PanelTitle>Disciplina</PanelTitle><View style={academicStyles.chips}>{demoTeacherSubjects.map((item) => <Chip key={item.id} label={item.title} selected={subjectId === item.id} onPress={() => { setSubjectId(item.id); setLessonId(`${item.id}-aula-3`); setDraft({}); setFeedback(''); }} />)}</View></Panel>
    <Panel><PanelTitle>Aula</PanelTitle><View style={academicStyles.chips}>{lessons.map((item) => <Chip key={item.id} label={formatAcademicDate(item.date)} selected={lessonId === item.id} onPress={() => { setLessonId(item.id); setDraft({}); setFeedback(''); }} />)}</View><Text style={academicStyles.meta}>{lessons.find((item) => item.id === lessonId)?.topic} · {subject.title}</Text></Panel>
    <Panel><PanelTitle>Lista de chamada</PanelTitle><Text style={academicStyles.meta}>{counts.PRESENT} presentes · {counts.ABSENT} faltas · {counts.JUSTIFIED} justificadas · {students.length} matriculados</Text>
      {students.map((student) => <View key={student.id} style={academicStyles.stack}><View style={academicStyles.row}><Text style={academicStyles.strong}>{student.name}</Text><Text style={academicStyles.meta}>{student.registration}</Text></View><View style={academicStyles.chips}>{statusOptions.map((option) => <Chip key={option.value} label={option.label} selected={valueFor(student.id) === option.value} onPress={() => { if (canEdit) setDraft((current) => ({ ...current, [student.id]: option.value })); }} />)}</View><View style={academicStyles.divider} /></View>)}
      {canEdit ? <><View style={academicStyles.chips}><ActionButton title="Todos presentes" secondary onPress={() => setDraft(Object.fromEntries(students.map((student) => [student.id, 'PRESENT'])) as Record<string, AttendanceStatus>)} /><ActionButton title="Todos ausentes" secondary onPress={() => setDraft(Object.fromEntries(students.map((student) => [student.id, 'ABSENT'])) as Record<string, AttendanceStatus>)} /></View><ActionButton title="Salvar chamada" onPress={save} /></> : <Text style={academicStyles.meta}>Tutoria: consulta somente leitura.</Text>}
      {feedback ? <Feedback message={feedback} error={!feedback.startsWith('Chamada demonstrativa')} /> : null}
    </Panel>
    <Panel><PanelTitle>Histórico da aula</PanelTitle><Text style={academicStyles.meta}>Registros anteriores podem ser consultados pelos botões de data. Edição com prazo e auditoria dependem da API institucional.</Text></Panel>
  </Screen>;
}
