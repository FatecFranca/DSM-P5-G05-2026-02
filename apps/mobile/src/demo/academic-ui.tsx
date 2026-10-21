import type { ReactNode } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TopBar } from '@/components/top-bar';
import { palette } from '@/constants/design';

export function AcademicHeader({ title, subtitle, back = false, backHref }: { title: string; subtitle?: string; back?: boolean; backHref?: Href }) {
  const router = useRouter();
  return <View style={styles.header}>
    <TopBar onBack={back ? () => backHref ? router.replace(backHref) : router.back() : undefined} />
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}
  </View>;
}

export function AcademicDemoNotice() {
  return <View style={styles.notice}><View style={styles.noticeBanner}><View style={styles.noticeDot} /><Text style={styles.noticeBannerText}>Dados acadêmicos fictícios para demonstração.</Text></View><Text style={styles.noticeText}>Ações nesta área alteram somente dados locais desta demonstração. Não são enviadas ao servidor.</Text></View>;
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.panelTitle}>{children}</Text>;
}

export function BodyText({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

export function ActionButton({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{title}</Text></Pressable>;
}

export function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad'; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.muted} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <Panel><Text style={styles.panelTitle}>{title}</Text><Text style={styles.body}>{detail}</Text></Panel>;
}

export function Feedback({ message, error = false }: { message: string; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.feedback, error && styles.feedbackError]}>{message}</Text>;
}

export function formatAcademicDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatAcademicNumber(value: number | null, digits = 1) {
  return value === null ? '—' : value.toFixed(digits).replace('.', ',');
}

export const academicStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  stack: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  strong: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  link: { color: palette.secondary, fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  divider: { height: 1, backgroundColor: palette.line },
});

const styles = StyleSheet.create({
  header: { gap: 5 },
  title: { color: palette.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.8 }, body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  notice: { gap: 6 }, noticeBanner: { backgroundColor: palette.goldSoft, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }, noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.gold }, noticeBannerText: { color: palette.ink, fontSize: 12, lineHeight: 18, flex: 1 }, noticeText: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  panel: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 17, gap: 12 },
  panelTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  stat: { flexGrow: 1, flexBasis: '43%', minWidth: 130, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 16, gap: 5 },
  statValue: { color: palette.primary, fontSize: 26, fontWeight: '800' }, statLabel: { color: palette.muted, fontSize: 12 },
  chip: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, borderRadius: 8, minHeight: 39, paddingHorizontal: 12, justifyContent: 'center' },
  chipSelected: { backgroundColor: palette.primary, borderColor: palette.primary }, chipText: { color: palette.ink, fontSize: 12, fontWeight: '700' }, chipTextSelected: { color: palette.surface },
  action: { minHeight: 45, backgroundColor: palette.primary, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  actionSecondary: { backgroundColor: palette.primarySoft }, actionText: { color: palette.surface, fontSize: 13, fontWeight: '700' }, actionTextSecondary: { color: palette.primary }, disabled: { opacity: 0.5 },
  field: { gap: 6 }, fieldLabel: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 45, borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: palette.ink, backgroundColor: palette.surface, fontSize: 14 }, multiline: { minHeight: 90, textAlignVertical: 'top' },
  feedback: { color: palette.success, fontSize: 12, lineHeight: 18, fontWeight: '700' }, feedbackError: { color: palette.danger },
});
