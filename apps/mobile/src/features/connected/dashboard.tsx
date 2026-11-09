import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, TextButton } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { palette, space, type } from '@/constants/design';
import { SegmentTabs, StatStrip } from '@/demo/academic-ui';
import { ComparisonBar, HistogramChart } from '@/demo/charts';
import { gradeBins } from '@/demo/statistics';
import { Card } from '@/demo/ui';
import { RequestState, connectedStyles } from './ui';
import { summarizeEnrollments, useAcademicOverview } from './overview';

const decimal = (value: number | null) => value === null ? '—' : value.toFixed(1).replace('.', ',');

/**
 * Painel da coordenação: como a instituição está agora. Primeiro quem pede atenção (estudantes sem nota
 * publicada), depois os números do recorte e os dois gráficos. Pessoas e Modelo têm aba própria; não se
 * repetem aqui.
 */
export function ConnectedDashboard() {
  const router = useRouter();
  const overview = useAcademicOverview();
  const [classId, setClassId] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const classes = overview.data?.classes ?? [];
  const enrollments = (overview.data?.enrollments ?? []).filter((item) => classId === 'all' || item.classId === classId);
  const stats = summarizeEnrollments(enrollments);
  const selectedClass = classes.find((item) => item.id === classId);
  const chosenBin = selectedGrade === null ? null : gradeBins[selectedGrade];
  const withoutGrade = stats.count - stats.graded;

  return <Screen>
    <TopBar />
    <View style={styles.titleBlock}>
      <Text accessibilityRole="header" style={styles.title}>Painel</Text>
      <Text style={styles.subtitle}>{selectedClass ? `${selectedClass.name} · ${selectedClass.course}` : 'Todas as turmas'}</Text>
    </View>
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {overview.data && <>
      {classes.length > 1 ? <SegmentTabs
        label="Turma"
        selected={classId}
        onSelect={(id) => { setClassId(id); setSelectedGrade(null); }}
        items={[{ key: 'all', label: 'Todas' }, ...classes.map((item) => ({ key: item.id, label: item.name }))]} /> : null}
      {!classes.length
        ? <Card>
          <Text style={connectedStyles.body}>Nenhuma turma cadastrada. Crie a primeira em Turmas e monte-a com disciplinas, docentes e estudantes.</Text>
          <TextButton flush title="Ir para Turmas" onPress={() => router.push('/connected/classes')} />
        </Card>
        : <>
          <StatStrip items={[
            { label: 'Estudantes', value: String(stats.count) },
            { label: 'Sem nota publicada', value: String(withoutGrade), tone: withoutGrade > 0 ? 'attention' : undefined },
            { label: 'Média das notas', value: decimal(stats.meanGrade) },
            { label: 'Presença média', value: stats.meanAttendance === null ? '—' : `${stats.meanAttendance.toFixed(0)}%` },
          ]} columns={2} />
          <Text style={styles.footnote}>Só entram notas e presenças publicadas.</Text>

          <Card>
            <Text style={connectedStyles.heading}>Distribuição das notas</Text>
            <HistogramChart counts={stats.histogram} selected={selectedGrade} onSelect={setSelectedGrade} />
            <Text accessibilityLiveRegion="polite" style={connectedStyles.caption}>{chosenBin ? `${stats.histogram[selectedGrade!]} estudante(s) com média entre ${chosenBin.label}.` : `Escala de 0 a 10. Toque em uma coluna para ver a contagem. ${stats.graded} de ${stats.count} com nota.`}</Text>
          </Card>

          {classes.length > 1 ? <Card>
            <Text style={connectedStyles.heading}>Comparar turmas</Text>
            {classes.map((item) => {
              const result = summarizeEnrollments(overview.data!.enrollments.filter((entry) => entry.classId === item.id));
              return result.meanGrade === null
                ? <Text key={item.id} style={connectedStyles.body}>{item.name} · sem nota publicada ({result.count} estudante(s))</Text>
                : <ComparisonBar key={item.id} label={item.name} value={result.meanGrade} count={result.count} selected={classId === item.id} onPress={() => { setClassId(item.id); setSelectedGrade(null); }} />;
            })}
          </Card> : null}
        </>}
      <TextButton title="Financeiro: mensalidades e bolsas" onPress={() => router.push('/financeiro')} />
      <TextButton title="Atualizar painel" onPress={overview.refresh} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  titleBlock: { gap: 2 },
  title: { color: palette.ink, ...type.title },
  subtitle: { color: palette.muted, ...type.body },
  footnote: { color: palette.muted, ...type.caption, marginTop: -space.sm },
});
