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
import { Bar, Card } from '@/demo/ui';
import { DataNotice, EnrollmentRow, InstitutionPicker, RequestState, connectedStyles } from './ui';
import { summarizeEnrollments, useAcademicOverview } from './overview';
import { classPredictionSummary, highestDropout } from './predictions';
import { useImportedPredictions } from './use-predictions';

export function ConnectedDashboard() {
  const router = useRouter();
  const { state } = useSession();
  const canViewModel = state.status === 'signedIn' && ['COORDENACAO'].includes(state.user.perfil);
  const overview = useAcademicOverview();
  const analysis = useImportedPredictions(canViewModel);
  const [classId, setClassId] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const classes = overview.data?.classes ?? [];
  const enrollments = (overview.data?.enrollments ?? []).filter((item) => classId === 'all' || item.classId === classId);
  const stats = summarizeEnrollments(enrollments);
  const selectedClass = classes.find((item) => item.id === classId);
  const chosenBin = selectedGrade === null ? null : gradeBins[selectedGrade];
  const rankedStudents = canViewModel ? highestDropout(enrollments, analysis.predictions).slice(0, 5) : [];

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
    <DataNotice>{canViewModel ? 'Chances do modelo são estimativas experimentais para apoio humano. Os gráficos usam as previsões atuais disponíveis entre as 50 importações mais recentes.' : 'Dados acadêmicos da API. Indicadores usam somente registros publicados.'}</DataNotice>
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
      {canViewModel && <Card>
        <View style={styles.chartHead}><Text style={connectedStyles.heading}>Chance média por turma</Text><Text style={styles.chartUnit}>Previsões atuais</Text></View>
        {analysis.loading && <Text style={connectedStyles.body}>Carregando análises…</Text>}
        {!!analysis.error && <Text accessibilityRole="alert" style={styles.error}>{analysis.error}</Text>}
        {analysis.items && classes.filter((item) => classId === 'all' || item.id === classId).map((item) => {
          const students = overview.data!.enrollments.filter((entry) => entry.classId === item.id);
          const result = classPredictionSummary(students, analysis.predictions);
          return <View key={item.id} style={styles.classPrediction}>
            <Text style={styles.classTitle}>{item.name}</Text>
            {result.count ? <>
              <Bar label="Evasão" value={result.dropout!} color={palette.danger} valueLabel={`${(result.dropout! * 100).toFixed(1).replace('.', ',')}%`} />
              <Bar label="Conclusão" value={result.graduate!} color={palette.success} valueLabel={`${(result.graduate! * 100).toFixed(1).replace('.', ',')}%`} />
              <Text style={connectedStyles.body}>{result.count} de {students.length} estudante(s) com previsão atual neste recorte</Text>
            </> : <Text style={connectedStyles.body}>Sem previsão atual neste recorte.</Text>}
          </View>;
        })}
        {analysis.items && !classes.length && <Text style={connectedStyles.body}>Nenhuma turma para analisar.</Text>}
        <Text style={connectedStyles.body}>Média das probabilidades disponíveis; não representa a turma inteira quando há análises ausentes.</Text>
      </Card>}
      <Card><View style={styles.chartHead}><Text style={connectedStyles.heading}>Distribuição das notas</Text><Text style={styles.chartUnit}>Estudantes por faixa</Text></View>
        <Text style={connectedStyles.body}>Médias acadêmicas publicadas em escala de 0 a 10. Toque em uma coluna para ver a contagem.</Text>
        <HistogramChart counts={stats.histogram} selected={selectedGrade} onSelect={setSelectedGrade} />
        <Text accessibilityLiveRegion="polite" style={connectedStyles.caption}>{chosenBin ? `${stats.histogram[selectedGrade!]} estudante(s) com média entre ${chosenBin.label}.` : `${stats.graded} de ${stats.count} estudante(s) com nota publicada.`}</Text>
      </Card>
      <Card><View style={styles.chartHead}><Text style={connectedStyles.heading}>Situação das análises</Text><Text style={styles.chartUnit}>Modelo preditivo</Text></View>
        <Text style={connectedStyles.body}>As análises importadas são estimativas experimentais. Abra um estudante para consultar as chances calculadas.</Text>
        {canViewModel && <Pressable accessibilityRole="button" onPress={() => router.push('/connected/model')}><Text style={styles.link}>Ver estado do modelo →</Text></Pressable>}
      </Card>
      <Card><View style={styles.chartHead}><Text style={connectedStyles.heading}>Comparar turmas</Text><Text style={styles.chartUnit}>Média acadêmica</Text></View>
        {classes.length ? classes.map((item) => { const result = summarizeEnrollments(overview.data!.enrollments.filter((entry) => entry.classId === item.id)); return result.meanGrade === null
          ? <Text key={item.id} style={connectedStyles.body}>{item.name} · sem nota publicada ({result.count} estudante(s))</Text>
          : <ComparisonBar key={item.id} label={item.name} value={result.meanGrade} count={result.count} selected={classId === item.id} onPress={() => setClassId(item.id)} />; }) : <Text style={connectedStyles.body}>Nenhuma turma para comparar.</Text>}
      </Card>
      {canViewModel ? <>
        <View style={connectedStyles.sectionHead}><Text style={connectedStyles.heading}>Maior chance de evasão</Text><Text style={connectedStyles.sectionHint}>Até 5 estudantes no recorte · estimativas</Text></View>
        {rankedStudents.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir análise de ${item.name}, ${item.className}`} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.userId } })} style={styles.riskStudent}>
          <View style={styles.riskStudentText}><Text style={styles.classTitle}>{item.name}</Text><Text style={connectedStyles.body}>{item.className} · {item.course}</Text></View>
          <Text style={styles.riskValue}>{(analysis.predictions[item.registration].probabilities.Dropout * 100).toFixed(1).replace('.', ',')}%</Text>
        </Pressable>)}
        {analysis.items && !rankedStudents.length && <Card><Text style={connectedStyles.body}>Nenhuma previsão atual encontrada para estudantes deste recorte.</Text></Card>}
      </> : <>
        <View style={connectedStyles.sectionHead}><Text style={connectedStyles.heading}>Estudantes</Text><Text style={connectedStyles.sectionHint}>Até 3 neste recorte</Text></View>
        {enrollments.slice(0, 3).map((item) => <EnrollmentRow key={item.id} enrollment={item} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.userId } })} />)}
        {!enrollments.length && <Card><Text style={connectedStyles.body}>Nenhum estudante vinculado às turmas selecionadas.</Text></Card>}
      </>}
      <TextButton title="Atualizar panorama" onPress={() => { overview.refresh(); if (canViewModel) analysis.refresh(); }} />
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
  error: { color: palette.danger, fontSize: 13 },
  classPrediction: { gap: 9, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 13 },
  classTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  riskStudent: { backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 11, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  riskStudentText: { flex: 1, gap: 3 }, riskValue: { color: palette.danger, fontSize: 17, fontWeight: '800' },
});
