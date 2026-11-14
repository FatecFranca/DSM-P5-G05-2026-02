import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { formatAcademicDate } from '@/demo/academic-ui';
import { Card, Metric } from '@/demo/ui';
import { studentSubjectData } from '@/features/connected/student-subject';
import { DataNotice, RequestState, connectedStyles } from '@/features/connected/ui';
import type { AcademicSnapshot, AttendanceStatus } from '@/services/academic';

const attendanceLabel: Record<AttendanceStatus, string> = {
  PRESENTE: 'Presente', FALTA: 'Falta', FALTA_JUSTIFICADA: 'Falta justificada',
};

export default function ConnectedStudentSubject() {
  const { id, classId } = useLocalSearchParams<{ id: string; classId: string }>();
  const goBack = useGoBack('/connected');
  const { state, request } = useSession();
  const studentId = state.status === 'signedIn' && state.user.perfil === 'ALUNO' ? state.user.id : null;
  const [snapshot, setSnapshot] = useState<AcademicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!studentId || !classId || !id) return;
    let active = true;
    void request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(classId)}`)
      .then((value) => {
        if (!active) return;
        if (value.truncated) throw new Error('O histórico da turma está incompleto. Tente novamente mais tarde.');
        setSnapshot(value);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a disciplina.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId, id, request, revision, studentId]);

  if (state.status === 'signedIn' && state.user.perfil !== 'ALUNO') return <Redirect href="/connected" />;
  const subject = snapshot?.disciplinas.find((item) => item.id === id && item.turmaId === classId);
  const enrollment = snapshot?.matriculas.find((item) => item.alunoId === studentId);
  const classroom = snapshot?.turmas.find((item) => item.id === classId);
  const details = subject && enrollment && snapshot ? studentSubjectData(snapshot, subject.id, enrollment.id) : null;
  const format = (value: number | null) => value === null ? '—' : value.toFixed(1).replace('.', ',');

  return <Screen><TopBar onBack={goBack} /><SectionTitle eyebrow="MINHA DISCIPLINA" title={subject?.nome ?? 'Disciplina'} />
    {subject && classroom && <Text style={connectedStyles.body}>{classroom.curso} · {classroom.nome} · {classroom.periodo}</Text>}
    <DataNotice>Registros acadêmicos da sua matrícula. Notas e atividades aparecem após publicação.</DataNotice>
    <RequestState loading={loading && !!id && !!classId} error={error} onRetry={() => { setLoading(true); setError(''); setSnapshot(null); setRevision((value) => value + 1); }} />
    {(!loading || !id || !classId) && !error && !details && <Card><Text style={connectedStyles.body}>Disciplina indisponível ou sem vínculo com sua matrícula.</Text></Card>}
    {details && !error && <>
      <View style={connectedStyles.metricGrid}>
        <Metric label="Presença" value={details.frequency === null ? '—' : `${format(details.frequency)}%`} />
        <Metric label="Presenças" value={String(details.present)} />
        <Metric label="Faltas" value={String(details.absent)} />
        <Metric label="Faltas justificadas" value={String(details.justified)} />
        <Metric label="Média publicada (0–10)" value={format(details.average)} />
      </View>
      <Card><Text style={styles.heading}>Presença e faltas</Text>
        {details.attendance.length ? details.attendance.map(({ lesson, status }) => <View key={lesson.id} style={styles.entry}>
          <Text style={styles.entryTitle}>{lesson.tema}</Text>
          <Text style={connectedStyles.body}>{formatAcademicDate(lesson.data)} · {status ? attendanceLabel[status] : 'Chamada não registrada'}</Text>
        </View>) : <Text style={connectedStyles.body}>Nenhuma aula registrada nesta disciplina.</Text>}
        <Text style={connectedStyles.body}>A frequência considera somente chamadas registradas; faltas justificadas são mostradas separadamente.</Text>
      </Card>
      <Card><Text style={styles.heading}>Notas</Text>
        {details.assessments.length ? details.assessments.map(({ assessment, grade }) => <View key={assessment.id} style={styles.entry}>
          <Text style={styles.entryTitle}>{assessment.titulo}</Text>
          <Text style={connectedStyles.body}>{formatAcademicDate(assessment.data)} · {grade === null ? 'Nota ainda não lançada' : `${format(grade)} de ${format(assessment.notaMaxima)}`} · peso {format(assessment.peso)}</Text>
        </View>) : <Text style={connectedStyles.body}>Nenhuma avaliação publicada nesta disciplina.</Text>}
      </Card>
      <Card><Text style={styles.heading}>Atividades</Text>
        {details.activities.length ? details.activities.map(({ activity, submission }) => <View key={activity.id} style={styles.entry}>
          <Text style={styles.entryTitle}>{activity.titulo}</Text>
          <Text style={connectedStyles.body}>Prazo: {formatAcademicDate(activity.prazo)} · {submission?.corrigidaEm ? 'Corrigida' : submission ? 'Entregue' : activity.estado === 'ENCERRADA' || Date.parse(activity.prazo) < now ? 'Prazo encerrado' : 'Pendente'}</Text>
          {!!activity.descricao && <Text style={connectedStyles.body}>{activity.descricao}</Text>}
          {submission?.nota !== null && submission?.nota !== undefined && <Text style={connectedStyles.caption}>Nota da atividade: {format(submission.nota)}</Text>}
        </View>) : <Text style={connectedStyles.body}>Nenhuma atividade publicada nesta disciplina.</Text>}
      </Card>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  heading: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  entry: { gap: 3, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line },
  entryTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
});
