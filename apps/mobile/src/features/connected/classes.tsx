import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionTitle, TextButton } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Card, Metric } from '@/demo/ui';
import { DataNotice, InstitutionPicker, RequestState, connectedStyles } from './ui';
import { summarizeEnrollments, useAcademicOverview } from './overview';

export function ConnectedClasses() {
  const router = useRouter();
  const overview = useAcademicOverview();
  return <Screen><TopBar /><SectionTitle eyebrow="VISÃO POR TURMA" title="Turmas" />
    <DataNotice>Turmas e indicadores da API. Médias são exibidas somente quando há notas publicadas.</DataNotice>
    <InstitutionPicker institutions={overview.institutions} selected={overview.institutionId} onSelect={overview.selectInstitution} />
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {overview.data && <>
      {overview.data.classes.length ? overview.data.classes.map((item) => {
        const summary = summarizeEnrollments(overview.data!.enrollments.filter((entry) => entry.classId === item.id));
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir turma ${item.name}`} onPress={() => router.push({ pathname: '/connected/class/[id]', params: { id: item.id } })}>
          <Card><View style={styles.titleRow}><Text style={styles.heading}>{item.name}</Text><Text style={styles.arrow}>→</Text></View>
            <Text style={connectedStyles.body}>{item.course} · {item.period}{item.closed ? ' · Período fechado' : ''}</Text>
            <View style={connectedStyles.metricGrid}><Metric label="Estudantes" value={String(summary.count)} /><Metric label="Média das notas" value={summary.meanGrade?.toFixed(1).replace('.', ',') ?? '—'} /><Metric label="Presença média" value={summary.meanAttendance === null ? '—' : `${summary.meanAttendance.toFixed(0)}%`} /></View>
          </Card>
        </Pressable>;
      }) : <Card><Text style={connectedStyles.heading}>Nenhuma turma disponível</Text><Text style={connectedStyles.body}>Confira seus vínculos acadêmicos ou cadastre uma turma.</Text></Card>}
      <TextButton title="Abrir gestão acadêmica" onPress={() => router.push('/workspace')} />
      <TextButton title="Atualizar turmas" onPress={overview.refresh} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { color: palette.ink, fontSize: 18, fontWeight: '700', flex: 1 },
  arrow: { color: palette.secondary, fontSize: 20 },
});
