import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle, TextButton } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Card, Metric } from '@/demo/ui';
import type { AcademicSnapshot } from '@/services/academic';
import { DataNotice, EnrollmentRow, RequestState, connectedStyles } from '@/features/connected/ui';
import { summarizeEnrollments, type EnrollmentView } from '@/features/connected/overview';

export default function ConnectedClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack('/connected/classes');
  const { request } = useSession();
  const [snapshot, setSnapshot] = useState<AcademicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(id)}`)
      .then((value) => { if (active) { if (value.truncated) throw new Error('A consulta da turma está incompleta.'); setSnapshot(value); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a turma.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload, request]);
  const selected = snapshot?.turmas.find((item) => item.id === id);
  const enrollments: EnrollmentView[] = selected ? (snapshot?.matriculas ?? []).map((item) => {
    const indicator = snapshot?.indicadores.find((value) => value.matriculaId === item.id);
    return { id: item.id, userId: item.alunoId, name: item.aluno.nome, registration: item.registro,
      classId: selected.id, className: selected.nome, course: selected.curso,
      average: indicator?.media ?? null, attendance: indicator?.frequencia ?? null };
  }) : [];
  const stats = summarizeEnrollments(enrollments);
  return <Screen><TopBar onBack={goBack} /><SectionTitle eyebrow="ANÁLISE DA TURMA" title={selected?.nome ?? 'Turma'} />
    <DataNotice>Dados acadêmicos da API. A análise preditiva permanece indisponível até validação para as Fatecs.</DataNotice>
    <RequestState loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); setSnapshot(null); setReload((value) => value + 1); }} />
    {!loading && !error && !selected && <Card><Text style={connectedStyles.body}>Turma não encontrada ou sem permissão de acesso.</Text></Card>}
    {selected && !error && <>
      <Card><Text style={connectedStyles.heading}>{selected.curso}</Text><Text style={connectedStyles.body}>{selected.periodo} · {selected.fechada ? 'Período fechado' : 'Período aberto'}</Text></Card>
      <View style={connectedStyles.metricGrid}><Metric label="Estudantes" value={String(stats.count)} /><Metric label="Média acadêmica" value={stats.meanGrade?.toFixed(1).replace('.', ',') ?? '—'} /><Metric label="Frequência" value={stats.meanAttendance === null ? '—' : `${stats.meanAttendance.toFixed(0)}%`} /></View>
      <Text style={styles.heading}>Estudantes</Text>
      {enrollments.map((item) => <EnrollmentRow key={item.id} enrollment={item} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.userId } })} />)}
      {!enrollments.length && <Card><Text style={connectedStyles.body}>Nenhum estudante matriculado nesta turma.</Text></Card>}
      <TextButton title="Gerenciar registros da turma" onPress={() => router.push({ pathname: '/workspace', params: { turmaId: selected.id, instituicaoId: selected.instituicaoId } })} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ heading: { color: palette.ink, fontSize: 17, fontWeight: '700' } });
