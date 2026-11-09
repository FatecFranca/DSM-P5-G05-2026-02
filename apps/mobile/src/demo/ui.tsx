import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, space, type } from '@/constants/design';
import { demoLabel, predictionLabel, type DemoStudent, type PredictionClass, type RiskLevel, riskLevel } from './data';

export function DemoBanner() {
  return <View style={styles.banner}><View style={styles.bannerDot} /><Text style={styles.bannerText}>{demoLabel}. Estimativas ilustrativas para apoio humano.</Text></View>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.secondary}>{label}</Text></View>;
}

export function Bar({ label, value, color = palette.secondary, valueLabel }: { label: string; value: number; color?: string; valueLabel?: string }) {
  const displayLabel = label in predictionLabel ? predictionLabel[label as PredictionClass] : label;
  return <View style={styles.barBlock}><View style={styles.barLabel}><Text style={styles.text}>{displayLabel}</Text><Text style={styles.secondary}>{valueLabel ?? `${Math.round(value * 100)}%`}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value * 100))}%`, backgroundColor: color }]} /></View></View>;
}

export const classColor: Record<PredictionClass, string> = { Dropout: palette.danger, Enrolled: palette.secondary, Graduate: palette.success };

const riskTone: Record<RiskLevel, { color: string; background: string }> = {
  Alto: { color: palette.dangerStrong, background: palette.dangerSoft },
  Médio: { color: palette.warning, background: palette.goldSoft },
  Baixo: { color: palette.success, background: palette.successSoft },
};

/** Faixa de atenção em pílula. O rótulo textual carrega o significado; a cor só reforça. */
export function RiskPill({ level }: { level: RiskLevel }) {
  const tone = riskTone[level];
  return <View style={[styles.pill, { backgroundColor: tone.background }]}><Text style={[styles.pillText, { color: tone.color }]}>{level}</Text></View>;
}

export function StudentRow({ student, showRisk, onPress }: { student: DemoStudent; showRisk: boolean; onPress: () => void }) {
  const risk = riskLevel(student.prediction.probabilities.Dropout);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir análise de ${student.name}${showRisk ? `, faixa de risco ${risk.toLowerCase()}` : ''}`} onPress={onPress} style={styles.row}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{student.name.slice(0, 1)}</Text></View>
    <View style={styles.rowText}><Text style={styles.rowTitle}>{student.name}</Text><Text style={styles.secondary}>Matrícula {student.registration} · Média {student.academicAverage.toFixed(1)}</Text></View>
    {showRisk ? <RiskPill level={risk} /> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  banner: { backgroundColor: palette.goldSoft, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  bannerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold, marginTop: 6 },
  bannerText: { color: palette.ink, ...type.caption, flex: 1 },
  card: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, padding: space.lg, gap: 14 },
  metric: { minWidth: 135, flexGrow: 1, flexBasis: '44%', padding: space.lg, backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, gap: 5 },
  metricValue: { color: palette.primary, ...type.figure },
  text: { fontSize: 14, color: palette.ink, fontWeight: '600' },
  secondary: { fontSize: 12, color: palette.muted },
  barBlock: { gap: 7 }, barLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: palette.background, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  row: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontWeight: '700' },
  rowText: { flex: 1, gap: 3 }, rowTitle: { fontSize: 14, color: palette.ink, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
