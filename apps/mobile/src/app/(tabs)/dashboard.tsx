import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { palette, roleLabel } from '@/constants/design';
import { demoClasses, demoStudents, riskLevel, studentsInClass, type RiskLevel } from '@/demo/data';
import { ComparisonBar, HistogramChart } from '@/demo/charts';
import { gradeBins, describeStudents } from '@/demo/statistics';
import { Card, DemoBanner, StudentRow } from '@/demo/ui';

const bands: { label: RiskLevel; color: string }[] = [
  { label: 'Alto', color: palette.danger },
  { label: 'Médio', color: palette.gold },
  { label: 'Baixo', color: palette.success },
];

export default function Dashboard() {
  const router = useRouter();
  const { state } = useSession();
  const [classId, setClassId] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedBand, setSelectedBand] = useState<RiskLevel>('Alto');
  if (state.status !== 'signedIn') return null;
  if (state.user.perfil === 'ALUNO') return <Screen><Text style={styles.pageTitle}>Meu espaço acadêmico</Text><DemoBanner /><Card><Text style={styles.body}>A visão individual será disponibilizada quando a API tiver matrícula e vínculos acadêmicos. Indicadores de outros estudantes não são exibidos.</Text></Card></Screen>;

  const students = classId === 'all' ? demoStudents : studentsInClass(classId);
  const summary = describeStudents(students);
  const selectedStudents = students.filter((student) => riskLevel(student.prediction.probabilities.Dropout) === selectedBand)
    .sort((a, b) => b.prediction.probabilities.Dropout - a.prediction.probabilities.Dropout).slice(0, 3);
  const selectedBin = selectedGrade === null ? null : gradeBins[selectedGrade];
  const selectedClass = demoClasses.find((item) => item.id === classId);

  return <Screen>
    <View style={styles.topline}>
      <View><Text style={styles.brand}>SGEI / Observatório</Text><Text style={styles.role}>{roleLabel[state.user.perfil]}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.push('/profile')} style={styles.profile}><Text style={styles.profileText}>Perfil</Text></Pressable>
    </View>

    <View style={styles.hero}>
      <Text style={styles.heroOverline}>Panorama acadêmico</Text>
      <Text style={styles.heroTitle}>{selectedClass ? selectedClass.name : 'Todas as turmas'}</Text>
      <View style={styles.heroDivider} />
      <View style={styles.heroBottom}>
        <View><Text style={styles.heroNumber}>{summary.count}</Text><Text style={styles.heroCaption}>estudantes no recorte</Text></View>
        <View style={styles.heroSide}><Text style={styles.heroSideNumber}>{summary.riskCounts.Alto}</Text><Text style={styles.heroSideCaption}>na faixa alta ilustrativa</Text></View>
      </View>
    </View>
    <DemoBanner />

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Selecione uma turma</Text><Text style={styles.sectionHint}>Os gráficos respondem ao filtro</Text></View>
    <View style={styles.chips}>
      {[{ id: 'all', name: 'Todas' }, ...demoClasses].map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: classId === item.id }} accessibilityLabel={`Filtrar turma ${item.name}`} onPress={() => { setClassId(item.id); setSelectedGrade(null); }} style={[styles.chip, classId === item.id && styles.chipActive]}><Text style={[styles.chipText, classId === item.id && styles.chipTextActive]}>{item.name}</Text></Pressable>)}
    </View>

    <View style={styles.statGrid}>
      <View style={styles.stat}><Text style={styles.statValue}>{summary.meanGrade?.toFixed(1) ?? '—'}</Text><Text style={styles.statLabel}>Média das notas</Text></View>
      <View style={styles.stat}><Text style={styles.statValue}>{summary.medianGrade?.toFixed(1) ?? '—'}</Text><Text style={styles.statLabel}>Mediana das notas</Text></View>
      <View style={styles.stat}><Text style={styles.statValue}>{summary.meanAttendance?.toFixed(0) ?? '—'}%</Text><Text style={styles.statLabel}>Presença média</Text></View>
    </View>

    <Card>
      <View style={styles.chartHead}><Text style={styles.sectionTitle}>Distribuição das notas</Text><Text style={styles.chartUnit}>Estudantes por faixa</Text></View>
      <Text style={styles.body}>Média acadêmica em escala de 0 a 10. Toque em uma coluna para ver a contagem.</Text>
      <HistogramChart counts={summary.histogram} selected={selectedGrade} onSelect={setSelectedGrade} />
      <Text accessibilityLiveRegion="polite" style={styles.chartDetail}>{selectedBin ? `${summary.histogram[selectedGrade!]} estudante(s) com média entre ${selectedBin.label}.` : `Média ${summary.meanGrade?.toFixed(1) ?? '—'} · mediana ${summary.medianGrade?.toFixed(1) ?? '—'}.`}</Text>
    </Card>

    <Card>
      <View style={styles.chartHead}><Text style={styles.sectionTitle}>Faixas de atenção</Text><Text style={styles.chartUnit}>Classificação ilustrativa</Text></View>
      <Text style={styles.body}>Contagem por faixa. Os limites são provisórios e não representam diagnóstico.</Text>
      <View style={styles.riskStack}>{bands.map((band) => <Pressable key={band.label} accessibilityRole="button" accessibilityState={{ selected: selectedBand === band.label }} accessibilityLabel={`Faixa ${band.label}: ${summary.riskCounts[band.label]} estudantes`} onPress={() => setSelectedBand(band.label)} style={[styles.riskRow, selectedBand === band.label && styles.riskRowActive]}>
        <View style={[styles.riskDot, { backgroundColor: band.color }]} /><Text style={styles.riskLabel}>{band.label}</Text>
        <View style={styles.riskTrack}><View style={[styles.riskFill, { width: `${summary.count ? summary.riskCounts[band.label] / summary.count * 100 : 0}%`, backgroundColor: band.color }]} /></View>
        <Text style={styles.riskCount}>{summary.riskCounts[band.label]}</Text>
      </Pressable>)}</View>
      <Text accessibilityLiveRegion="polite" style={styles.chartDetail}>{summary.riskCounts[selectedBand]} de {summary.count} estudantes na faixa {selectedBand.toLowerCase()} ({summary.count ? Math.round(summary.riskCounts[selectedBand] / summary.count * 100) : 0}%).</Text>
    </Card>

    <Card>
      <View style={styles.chartHead}><Text style={styles.sectionTitle}>Comparar turmas</Text><Text style={styles.chartUnit}>Média acadêmica</Text></View>
      {demoClasses.map((item) => { const result = describeStudents(studentsInClass(item.id)); return <ComparisonBar key={item.id} label={item.name} value={result.meanGrade ?? 0} count={result.count} selected={classId === item.id} onPress={() => { setClassId(item.id); setSelectedGrade(null); }} />; })}
    </Card>

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Estudantes na faixa {selectedBand.toLowerCase()}</Text><Text style={styles.sectionHint}>Até 3 neste recorte</Text></View>
    {selectedStudents.length ? selectedStudents.map((student) => <StudentRow key={student.id} student={student} showRisk onPress={() => router.push({ pathname: '/students/[id]', params: { id: student.id } })} />) : <Card><Text style={styles.body}>Nenhum estudante nesta faixa e turma.</Text></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  pageTitle: { color: palette.ink, fontSize: 28, fontWeight: '800' },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: palette.primary, fontSize: 15, fontWeight: '800' }, role: { color: palette.muted, fontSize: 12, marginTop: 3 },
  profile: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.surface },
  profileText: { color: palette.primary, fontWeight: '700', fontSize: 13 },
  hero: { backgroundColor: palette.primary, borderRadius: 15, padding: 24, gap: 9 },
  heroOverline: { color: '#A7D6CF', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: palette.surface, fontSize: 30, fontWeight: '800', letterSpacing: -1, lineHeight: 35 },
  heroDivider: { height: 1, backgroundColor: '#4F7075', marginTop: 10 },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  heroNumber: { color: palette.surface, fontSize: 49, fontWeight: '800', lineHeight: 56, letterSpacing: -2 },
  heroCaption: { color: '#C3DCDA', fontSize: 12 },
  heroSide: { alignItems: 'flex-end', paddingBottom: 2 }, heroSideNumber: { color: palette.gold, fontSize: 29, fontWeight: '800' }, heroSideCaption: { color: '#C3DCDA', fontSize: 11, maxWidth: 125, textAlign: 'right' },
  sectionHead: { gap: 2 }, sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }, sectionHint: { color: palette.muted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: palette.line, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: palette.surface },
  chipActive: { backgroundColor: palette.primary, borderColor: palette.primary }, chipText: { color: palette.ink, fontSize: 12, fontWeight: '600' }, chipTextActive: { color: palette.surface },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, stat: { flexGrow: 1, flexBasis: '30%', minWidth: 125, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 11, padding: 15, gap: 4 },
  statValue: { color: palette.primary, fontSize: 26, fontWeight: '800', letterSpacing: -1 }, statLabel: { color: palette.muted, fontSize: 11 },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }, chartUnit: { color: palette.muted, fontSize: 11 },
  body: { color: palette.muted, fontSize: 12, lineHeight: 19 }, chartDetail: { color: palette.secondary, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  riskStack: { gap: 5 }, riskRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 10, borderRadius: 8 }, riskRowActive: { backgroundColor: palette.background },
  riskDot: { width: 9, height: 9, borderRadius: 5 }, riskLabel: { width: 44, color: palette.ink, fontSize: 12, fontWeight: '700' },
  riskTrack: { flex: 1, height: 9, backgroundColor: palette.background, borderRadius: 5, overflow: 'hidden' }, riskFill: { height: 9, borderRadius: 5 }, riskCount: { width: 22, textAlign: 'right', color: palette.ink, fontSize: 13, fontWeight: '800' },
});
