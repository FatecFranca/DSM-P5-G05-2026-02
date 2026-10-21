import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInsideTabs } from '@/components/app-tabs';
import { palette } from '@/constants/design';

export function Screen({ children }: { children: ReactNode }) {
  const insideTabs = useInsideTabs();
  const { bottom } = useSafeAreaInsets();
  // Dentro das abas a barra inferior já ocupa a área segura; fora delas o conteúdo rola até a borda.
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <View style={[styles.content, !insideTabs && { paddingBottom: 44 + bottom }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.mark, compact && styles.markCompact]} accessibilityLabel="SGEI">
      <Text style={[styles.markLetter, compact && styles.markLetterCompact]}>S</Text>
      <View style={styles.markDot} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        danger && styles.dangerButton,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}>
      {loading ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function TextButton({ title, onPress, danger = false }: { title: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      <Text style={[styles.textButtonLabel, danger && styles.danger]}>{title}</Text>
    </Pressable>
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const detail = eyebrow ? eyebrow.charAt(0).toLocaleUpperCase('pt-BR') + eyebrow.slice(1).toLocaleLowerCase('pt-BR') : null;
  return (
    <View style={styles.sectionTitle}>
      {detail ? <Text style={styles.eyebrow}>{detail}</Text> : null}
      <Text style={styles.heading}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: 900, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 44, gap: 22 },
  mark: { width: 64, height: 64, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  markCompact: { width: 44, height: 44, borderRadius: 10 },
  markLetter: { color: palette.surface, fontSize: 36, fontWeight: '900', lineHeight: 44 },
  markLetterCompact: { fontSize: 26, lineHeight: 32 },
  markDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold, position: 'absolute', right: 12, top: 13 },
  primaryButton: { minHeight: 54, backgroundColor: palette.primary, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  dangerButton: { backgroundColor: palette.danger },
  primaryText: { color: palette.surface, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
  textButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  textButtonLabel: { color: palette.primary, fontSize: 15, fontWeight: '700' },
  danger: { color: palette.danger },
  sectionTitle: { gap: 5 },
  eyebrow: { color: palette.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  heading: { color: palette.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.9 },
});
