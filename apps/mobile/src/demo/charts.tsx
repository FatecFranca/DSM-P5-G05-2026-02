import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/design';
import { gradeBins } from './statistics';

interface HistogramChartProps {
  counts: number[];
  selected: number | null;
  onSelect: (index: number) => void;
}

export function HistogramChart({ counts, selected, onSelect }: HistogramChartProps) {
  const maximum = Math.max(1, ...counts);
  return <View>
    <View style={styles.plot}>
      {counts.map((count, index) => <Pressable
        key={gradeBins[index].label}
        accessibilityRole="button"
        accessibilityLabel={`Faixa de nota ${gradeBins[index].label}: ${count} estudantes`}
        accessibilityState={{ selected: selected === index }}
        onPress={() => onSelect(index)}
        style={styles.column}>
        <Text style={[styles.count, selected === index && styles.countSelected]}>{count}</Text>
        <View style={[styles.columnBar, { height: Math.max(6, count / maximum * 105) }, selected === index && styles.columnSelected]} />
      </Pressable>)}
    </View>
    <View style={styles.axis}>{gradeBins.map((bin) => <Text key={bin.label} style={styles.axisLabel}>{bin.label}</Text>)}</View>
  </View>;
}

interface ComparisonBarProps {
  label: string;
  value: number;
  count: number;
  selected: boolean;
  onPress: () => void;
}

export function ComparisonBar({ label, value, count, selected, onPress }: ComparisonBarProps) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${label}, média ${value.toFixed(1)}, ${count} estudantes`}
    accessibilityState={{ selected }}
    onPress={onPress}
    style={[styles.comparison, selected && styles.comparisonSelected]}>
    <View style={styles.comparisonHead}><Text style={styles.comparisonLabel}>{label}</Text><Text style={styles.comparisonValue}>{value.toFixed(1)}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value * 10))}%` }]} /></View>
    <Text style={styles.comparisonMeta}>{count} estudantes · escala de 0 a 10</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  plot: { height: 140, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: palette.line, gap: 8 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 130, gap: 5 },
  count: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  countSelected: { color: palette.primary },
  columnBar: { width: '100%', maxWidth: 60, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#A8CCC7' },
  columnSelected: { backgroundColor: palette.secondary },
  axis: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  axisLabel: { flex: 1, textAlign: 'center', color: palette.muted, fontSize: 11 },
  comparison: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, gap: 6 },
  comparisonSelected: { backgroundColor: palette.primarySoft },
  comparisonHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  comparisonLabel: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  comparisonValue: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, backgroundColor: palette.background, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: palette.secondary },
  comparisonMeta: { color: palette.muted, fontSize: 11 },
});
