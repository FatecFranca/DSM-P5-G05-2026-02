import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, TextButton } from '@/components/primitives';
import { useSession } from '@/auth/session';
import { TopBar } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Chip } from '@/demo/academic-ui';
import { ComparisonBar, HistogramChart } from '@/demo/charts';
import { gradeBins } from '@/demo/statistics';
import { Card } from '@/demo/ui';
import { DataNotice, EnrollmentRow, InstitutionPicker, RequestState, connectedStyles } from './ui';
import { summarizeEnrollments, useAcademicOverview } from './overview';

export function ConnectedDashboard() {
  const router = useRouter();
  const { state } = useSession();
  const canViewModel = state.status === 'signedIn' && ['ADMIN', 'COORDENACAO'].includes(state.user.perfil);
  const overview = useAcademicOverview();
  const [classId, setClassId] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const classes = overview.data?.classes ?? [];
  const enrollments = (overview.data?.enrollments ?? []).filter((item) => classId === 'all' || item.classId === classId);
  const stats = summarizeEnrollments(enrollments);
  const selectedClass = classes.find((item) => item.id === classId);
  const chosenBin = selectedGrade === null ? null : gradeBins[selectedGrade];

  return <Screen>
    <TopBar />
    <View style={styles.hero}>
      <Text style={styles.heroOverline}>Panorama acadêmico</Text>
      <Text style={styles.heroTitle}>{selectedClass?.name ?? 'Todas as turmas'}</Text>
      <View style={styles.heroDivider} />
      <View style={styles.heroBottom}>
        <View><Text style={styles.heroNumber}>{stats.count}</Text><Text style={styles.heroCaption}>estudantes no recorte</Text></View>
        <View style={styles.heroSide}><Text style={styles.heroSideNumber}>{stats.graded}</Text><Text style={styles.heroSideCaption}>com nota publicada</Text></View>
      </View>
    </View>
    <DataNotice>Dados acadêmicos da API. Indicadores usam somente registros publicados; nenhuma previsão de abandono está disponível.</DataNotice>
    <InstitutionPicker institutions={overview.institutions} selected={overview.institutionId} onSelect={(id) => { setClassId('all'); setSelectedGrade(null); overview.selectInstitution(id); }} />
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {overview.data && <>
      <View style={connectedStyles.sectionHead}><Text style={connectedStyles.heading}>Selecione uma turma</Text><Text style={connectedStyles.sectionHint}>Os indicadores respondem ao filtro</Text></View>
      <View style={connectedStyles.chips}><Chip label="Todas" selected={classId === 'all'} onPress={() => { setClassId('all'); setSelectedGrade(null); }} />{classes.map((item) => <Chip key={item.id} label={item.name} selected={classId === item.id} onPress={() => { setClassId(item.id); setSelectedGrade(null); }} />)}</View>
      {!classes.length && <Card><Text style={connectedStyles.body}>Nenhuma turma disponível para este vínculo.</Text></Card>}
      <View style={styles.statGrid}>
        <Stat value={stats.meanGrade?.toFixed(1).replace('.', ',') ?? '—'} label="Média das notas" />
        <Stat value={stats.medianGrade?.toFixed(1).replace('.', ',') ?? '—'} label="Mediana das notas" />
        <Stat value={stats.meanAttendance === null ? '—' : `${stats.meanAttendance.toFixed(0)}%`} label="Presença média" />
      </View>
      <Card><View style={styles.chartHead}><Text style={connectedStyles.heading}>Distribuição das notas</Text><Text style={styles.chartUnit}>Estudantes por faixa</Text></View>
        <Text style={connectedStyles.body}>Médias acadêmicas publicadas em escala de 0 a 10. Toque em uma coluna para ver a contagem.</Text>
        <HistogramChart counts={stats.histogram} selected={selectedGrade} onSelect={setSelectedGrade} />
        <Text accessibilityLiveRegion="polite" style={connectedStyles.caption}>{chosenBin ? `${stats.histogram[selectedGrade!]} estudante(s) com média entre ${chosenBin.label}.` : `${stats.graded} de ${stats.count} estudante(s) com nota publicada.`}</Text>
      </Card>
      <Card><View style={styles.chartHead}><Text style={connectedStyles.heading}>Situação das análises</Text><Text style={styles.chartUnit}>Modelo preditivo</Text></View>
        <Text style={connectedStyles.body}>O modelo candidato ainda não foi validado com estudantes das Fatecs. A análise individual informa os dados e validações pendentes, sem atribuir faixa ou probabilidade.</Text>
        {canViewModel && <Pressable accessibilityRole="button" onPress={() => router.push('/connected/model')}><Text style={styles.link}>Ver estado do modelo →</Text></Pressable>}
      </Card>
      <Card><View style={styles.chartHead}><Text style={connectedStyles.heading}>Comparar turmas</Text><Text style={styles.chartUnit}>Média acadêmica</Text></View>
        {classes.length ? classes.map((item) => { const result = summarizeEnrollments(overview.data!.enrollments.filter((entry) => entry.classId === item.id)); return result.meanGrade === null
          ? <Text key={item.id} style={connectedStyles.body}>{item.name} · sem nota publicada ({result.count} estudante(s))</Text>
          : <ComparisonBar key={item.id} label={item.name} value={result.meanGrade} count={result.count} selected={classId === item.id} onPress={() => setClassId(item.id)} />; }) : <Text style={connectedStyles.body}>Nenhuma turma para comparar.</Text>}
      </Card>
      <View style={connectedStyles.sectionHead}><Text style={connectedStyles.heading}>Estudantes</Text><Text style={connectedStyles.sectionHint}>Até 3 neste recorte</Text></View>
      {enrollments.slice(0, 3).map((item) => <EnrollmentRow key={item.id} enrollment={item} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.userId } })} />)}
      {!enrollments.length && <Card><Text style={connectedStyles.body}>Nenhum estudante vinculado às turmas selecionadas.</Text></Card>}
      <TextButton title="Atualizar panorama" onPress={overview.refresh} />
    </>}
  </Screen>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.primary, borderRadius: 15, padding: 24, gap: 9 },
  heroOverline: { color: '#A7D6CF', fontSize: 13, fontWeight: '600' }, heroTitle: { color: palette.surface, fontSize: 30, fontWeight: '800', letterSpacing: -1, lineHeight: 35 },
  heroDivider: { height: 1, backgroundColor: '#4F7075', marginTop: 10 }, heroBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  heroNumber: { color: palette.surface, fontSize: 49, fontWeight: '800', lineHeight: 56, letterSpacing: -2 }, heroCaption: { color: '#C3DCDA', fontSize: 12 },
  heroSide: { alignItems: 'flex-end', paddingBottom: 2 }, heroSideNumber: { color: palette.gold, fontSize: 29, fontWeight: '800' }, heroSideCaption: { color: '#C3DCDA', fontSize: 11, maxWidth: 125, textAlign: 'right' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, stat: { flexGrow: 1, flexBasis: '30%', minWidth: 125, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 11, padding: 15, gap: 4 },
  statValue: { color: palette.primary, fontSize: 26, fontWeight: '800', letterSpacing: -1 }, statLabel: { color: palette.muted, fontSize: 11 },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }, chartUnit: { color: palette.muted, fontSize: 11 },
  link: { color: palette.secondary, fontSize: 13, fontWeight: '700', paddingVertical: 8 },
});
