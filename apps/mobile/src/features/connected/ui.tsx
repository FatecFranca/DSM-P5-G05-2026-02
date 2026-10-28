import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/design';
import { Card } from '@/demo/ui';
import type { InstituicaoOption } from '@/services/api';
import type { EnrollmentView } from './overview';

interface InstitutionPickerProps {
  institutions: InstituicaoOption[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export function InstitutionPicker({ institutions, selected, onSelect }: InstitutionPickerProps) {
  if (!institutions.length) return null;
  return <View style={styles.institutionBlock}><Text style={connectedStyles.heading}>Fatec</Text><View style={styles.chips}>{institutions.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Filtrar ${item.nome}`} accessibilityState={{ selected: selected === item.id }} onPress={() => onSelect(item.id)} style={[styles.institutionChip, selected === item.id && styles.institutionChipSelected]}><Text style={[styles.institutionText, selected === item.id && styles.institutionTextSelected]}>{item.nome.replace(/^Fatec\s+/i, '').split('–')[0].trim()}</Text></Pressable>)}</View></View>;
}

export function DataNotice({ children }: { children: string }) {
  return <View style={styles.notice}><View style={styles.noticeDot} /><Text style={styles.noticeText}>{children}</Text></View>;
}

interface RequestStateProps {
  loading: boolean;
  error: string;
  onRetry: () => void;
}

export function RequestState({ loading, error, onRetry }: RequestStateProps) {
  if (loading) return <View style={styles.state}><ActivityIndicator color={palette.primary} /><Text style={styles.stateText}>Carregando dados acadêmicos…</Text></View>;
  if (!error) return null;
  return <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry}><Text style={styles.link}>Tentar novamente →</Text></Pressable></Card>;
}

interface EnrollmentRowProps {
  enrollment: EnrollmentView;
  onPress: () => void;
}

export function EnrollmentRow({ enrollment, onPress }: EnrollmentRowProps) {
  const grade = enrollment.average === null ? 'Sem nota publicada' : `Média ${enrollment.average.toFixed(1).replace('.', ',')}`;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${enrollment.name}`} onPress={onPress} style={styles.row}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{enrollment.name.slice(0, 1).toLocaleUpperCase('pt-BR')}</Text></View>
    <View style={styles.rowText}><Text style={styles.rowTitle}>{enrollment.name}</Text><Text style={styles.rowMeta}>{enrollment.registration} · {grade}</Text></View>
    <Text style={styles.arrow}>→</Text>
  </Pressable>;
}

export const connectedStyles = StyleSheet.create({
  heading: { color: palette.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  caption: { color: palette.secondary, fontSize: 12, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  sectionHead: { gap: 2 },
  sectionHint: { color: palette.muted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

const styles = StyleSheet.create({
  institutionBlock: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  institutionChip: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 8, minHeight: 39, paddingHorizontal: 12, justifyContent: 'center' },
  institutionChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  institutionText: { color: palette.ink, fontSize: 12, fontWeight: '700' }, institutionTextSelected: { color: palette.surface },
  notice: { backgroundColor: palette.goldSoft, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.gold },
  noticeText: { color: palette.ink, fontSize: 12, lineHeight: 18, flex: 1 },
  state: { alignItems: 'center', gap: 9, padding: 28 }, stateText: { color: palette.muted, fontSize: 13 },
  error: { color: palette.danger, fontSize: 13, lineHeight: 19 }, link: { color: palette.secondary, fontWeight: '700', paddingVertical: 8 },
  row: { backgroundColor: palette.surface, borderRadius: 11, borderWidth: 1, borderColor: palette.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontWeight: '700' }, rowText: { flex: 1, gap: 3 }, rowTitle: { fontSize: 14, color: palette.ink, fontWeight: '700' },
  rowMeta: { color: palette.muted, fontSize: 12 }, arrow: { color: palette.secondary, fontSize: 18, fontWeight: '700' },
});
