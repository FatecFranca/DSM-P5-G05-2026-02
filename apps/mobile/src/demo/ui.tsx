import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/design';
import { demoLabel, predictionLabel, type DemoStudent, type PredictionClass, riskLevel } from './data';

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

export function StudentRow({ student, showRisk, onPress }: { student: DemoStudent; showRisk: boolean; onPress: () => void }) {
  const risk = riskLevel(student.prediction.probabilities.Dropout);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir análise de ${student.name}`} onPress={onPress} style={styles.row}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{student.name.slice(0, 1)}</Text></View>
    <View style={styles.rowText}><Text style={styles.rowTitle}>{student.name}</Text><Text style={styles.secondary}>Matrícula {student.registration} · Média {student.academicAverage.toFixed(1)}</Text></View>
    {showRisk ? <Text style={[styles.badge, { color: risk === 'Alto' ? palette.danger : palette.secondary }]}>{risk}</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  banner: { backgroundColor: palette.goldSoft, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.gold },
  bannerText: { color: palette.ink, fontSize: 12, lineHeight: 18, flex: 1 },
  card: { backgroundColor: palette.surface, borderRadius: 13, borderWidth: 1, borderColor: palette.line, padding: 18, gap: 14 },
  metric: { minWidth: 135, flexGrow: 1, flexBasis: '44%', padding: 16, backgroundColor: palette.surface, borderRadius: 11, borderWidth: 1, borderColor: palette.line, gap: 5 },
  metricValue: { fontSize: 25, fontWeight: '800', color: palette.primary, letterSpacing: -0.9 },
  text: { fontSize: 14, color: palette.ink, fontWeight: '600' },
  secondary: { fontSize: 12, color: palette.muted },
  barBlock: { gap: 7 }, barLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: palette.background, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  row: { backgroundColor: palette.surface, borderRadius: 11, borderWidth: 1, borderColor: palette.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontWeight: '700' },
  rowText: { flex: 1, gap: 3 }, rowTitle: { fontSize: 14, color: palette.ink, fontWeight: '700' },
  badge: { fontSize: 12, fontWeight: '700' },
});
