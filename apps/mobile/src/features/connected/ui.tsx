import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icons';
import { palette, radius, space, type } from '@/constants/design';
import { ActionButton, SkeletonRows } from '@/demo/academic-ui';
import { Card } from '@/demo/ui';
import type { EnrollmentView } from './overview';

export function DataNotice({ children }: { children: string }) {
  return <View style={styles.notice}><View style={styles.noticeDot} /><Text style={styles.noticeText}>{children}</Text></View>;
}

interface RequestStateProps {
  loading: boolean;
  error: string;
  onRetry: () => void;
}

export function RequestState({ loading, error, onRetry }: RequestStateProps) {
  if (loading) return <Card><SkeletonRows /></Card>;
  if (!error) return null;
  return <Card>
    <Text accessibilityRole="header" style={connectedStyles.heading}>Não foi possível carregar</Text>
    <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
    <ActionButton secondary title="Tentar novamente" onPress={onRetry} />
  </Card>;
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
    <Icon name="chevronRight" color={palette.muted} size={20} />
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
  notice: { backgroundColor: palette.goldSoft, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold, marginTop: 6 },
  noticeText: { color: palette.ink, ...type.caption, flex: 1 },
  error: { color: palette.muted, fontSize: 13, lineHeight: 19 }, link: { color: palette.secondary, fontWeight: '700', paddingVertical: 8 },
  row: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontWeight: '700' }, rowText: { flex: 1, gap: 3 }, rowTitle: { fontSize: 14, color: palette.ink, fontWeight: '700' },
  rowMeta: { color: palette.muted, fontSize: 12 },
});
