import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { palette } from '@/constants/design';
import { demoModelMetrics } from '@/demo/data';
import { evaluateConfusionMatrix } from '@/demo/statistics';
import { Card, DemoBanner } from '@/demo/ui';

const labels = ['Evasão', 'Matriculado', 'Concluiu'] as const;
const report = evaluateConfusionMatrix(demoModelMetrics.confusionMatrix);

export default function Metrics() {
  const { state } = useSession();
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ actual: number; predicted: number } | null>(null);
  if (state.status !== 'signedIn') return null;
  if (!['ADMIN', 'COORDENACAO'].includes(state.user.perfil)) return <Screen><Text style={styles.title}>Avaliação do modelo</Text><Card><Text style={styles.body}>Métricas do modelo são restritas à administração e coordenação.</Text></Card></Screen>;
  const current = report.classes[selectedClass];
  const matrix = demoModelMetrics.confusionMatrix;

  return <Screen>
    <View style={styles.heading}><Text style={styles.kicker}>Avaliação demonstrativa</Text><Text style={styles.title}>Qualidade do modelo</Text><Text style={styles.body}>Como o classificador fictício se comporta em 30 exemplos ilustrativos.</Text></View>
    <DemoBanner />

    <View style={styles.hero}>
      <View><Text style={styles.heroLabel}>Acertos no conjunto ilustrativo</Text><Text style={styles.heroValue}>{Math.round(report.accuracy * 100)}%</Text><Text style={styles.heroCaption}>{Math.round(report.accuracy * report.total)} de {report.total} classificações corretas</Text></View>
      <View style={styles.heroRule} />
      <View style={styles.heroFooter}><Text style={styles.heroFootLabel}>F1 macro</Text><Text style={styles.heroFootValue}>{Math.round(report.macroF1 * 100)}%</Text><Text style={styles.heroFootLabel}>Recall balanceado</Text><Text style={styles.heroFootValue}>{Math.round(report.balancedAccuracy * 100)}%</Text></View>
    </View>

    <Card>
      <Text style={styles.sectionTitle}>Explore por classe</Text>
      <Text style={styles.body}>Selecione uma situação para comparar precisão, cobertura e F1.</Text>
      <View style={styles.chips}>{labels.map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: selectedClass === index }} onPress={() => setSelectedClass(index)} style={[styles.chip, selectedClass === index && styles.chipActive]}><Text style={[styles.chipText, selectedClass === index && styles.chipTextActive]}>{label}</Text></Pressable>)}</View>
      <Text style={styles.classCaption}>{labels[selectedClass]} · {current.support} casos reais</Text>
      <MetricRow title="Precisão" value={current.precision} description="Entre os previstos nesta classe" />
      <MetricRow title="Recall" value={current.recall} description="Entre os casos reais desta classe" />
      <MetricRow title="F1" value={current.f1} description="Equilíbrio entre precisão e recall" />
    </Card>

    <Card>
      <Text style={styles.sectionTitle}>Matriz de confusão</Text>
      <Text style={styles.body}>Linhas: situação real. Colunas: classificação prevista. Toque em uma célula.</Text>
      <View style={styles.matrixHeader}><Text style={styles.corner}>Real / Prev.</Text>{labels.map((label) => <Text key={label} style={styles.columnLabel} numberOfLines={2}>{label}</Text>)}</View>
      {matrix.map((row, actual) => <View key={labels[actual]} style={styles.matrixRow}><Text style={styles.rowLabel}>{labels[actual]}</Text>{row.map((value, predicted) => <Pressable key={`${actual}-${predicted}`} accessibilityRole="button" accessibilityLabel={`${value} casos de ${labels[actual]} classificados como ${labels[predicted]}`} accessibilityState={{ selected: selectedCell?.actual === actual && selectedCell.predicted === predicted }} onPress={() => setSelectedCell({ actual, predicted })} style={[styles.cell, { backgroundColor: actual === predicted ? '#D6EDE5' : value ? '#FBE9E5' : palette.background }, selectedCell?.actual === actual && selectedCell.predicted === predicted && styles.cellSelected]}><Text style={styles.cellValue}>{value}</Text></Pressable>)}</View>)}
      <Text accessibilityLiveRegion="polite" style={styles.detail}>{selectedCell ? `${matrix[selectedCell.actual][selectedCell.predicted]} caso(s): ${labels[selectedCell.actual]} na realidade, ${labels[selectedCell.predicted]} na previsão.` : 'A diagonal mostra acertos; as demais células mostram erros.'}</Text>
    </Card>

    <Text style={styles.footnote}>{demoModelMetrics.name}, versão {demoModelMetrics.version}. Números fictícios calculados da matriz ilustrativa. Sem validação real, calibração ou uso para decisões acadêmicas.</Text>
  </Screen>;
}

function MetricRow({ title, value, description }: { title: string; value: number; description: string }) {
  return <View style={styles.metricRow}><View style={styles.metricHead}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricValue}>{Math.round(value * 100)}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value * 100))}%` }]} /></View><Text style={styles.metricDescription}>{description}</Text></View>;
}

const styles = StyleSheet.create({
  heading: { gap: 5 }, kicker: { color: palette.secondary, fontSize: 12, fontWeight: '700' }, title: { color: palette.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  hero: { backgroundColor: palette.primary, borderRadius: 15, padding: 23, gap: 16 }, heroLabel: { color: '#B9D8D5', fontSize: 12 }, heroValue: { color: palette.surface, fontSize: 56, fontWeight: '800', letterSpacing: -2, lineHeight: 64 }, heroCaption: { color: '#C8E2DF', fontSize: 12 },
  heroRule: { height: 1, backgroundColor: '#4F7075' }, heroFooter: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }, heroFootLabel: { color: '#C8E2DF', fontSize: 12 }, heroFootValue: { color: palette.gold, fontSize: 20, fontWeight: '800', marginRight: 14 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { backgroundColor: palette.primary, borderColor: palette.primary }, chipText: { color: palette.ink, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: palette.surface },
  classCaption: { color: palette.secondary, fontSize: 12, fontWeight: '800', marginTop: 4 },
  metricRow: { gap: 5, paddingVertical: 6 }, metricHead: { flexDirection: 'row', justifyContent: 'space-between' }, metricTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' }, metricValue: { color: palette.primary, fontSize: 14, fontWeight: '800' }, metricDescription: { color: palette.muted, fontSize: 11 }, track: { height: 8, borderRadius: 4, backgroundColor: palette.background, overflow: 'hidden' }, fill: { height: 8, borderRadius: 4, backgroundColor: palette.secondary },
  matrixHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 }, matrixRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, corner: { width: 74, color: palette.muted, fontSize: 10 }, columnLabel: { flex: 1, color: palette.muted, fontSize: 10, textAlign: 'center' }, rowLabel: { width: 74, color: palette.ink, fontSize: 11, fontWeight: '700' },
  cell: { flex: 1, minHeight: 52, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }, cellSelected: { borderColor: palette.primary }, cellValue: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  detail: { color: palette.secondary, fontSize: 12, lineHeight: 18, fontWeight: '700' }, footnote: { color: palette.muted, fontSize: 12, lineHeight: 19 },
});
