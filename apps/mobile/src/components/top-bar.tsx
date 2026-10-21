import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/session';
import { palette, roleLabel } from '@/constants/design';

/** Volta para a tela anterior; sem histórico (link direto, recarga na web), abre `fallback`. */
export function useGoBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [fallback, router]);
}

/**
 * Linha superior comum: marca ou botão Voltar à esquerda e acesso à conta (perfil e saída)
 * à direita, com área de toque de pelo menos 44 pt.
 */
export function TopBar({ onBack, showAccount = true }: { onBack?: () => void; showAccount?: boolean }) {
  const router = useRouter();
  const { state } = useSession();
  const perfil = state.status === 'signedIn' ? state.user.perfil : null;
  return <View style={styles.bar}>
    {onBack
      ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>← Voltar</Text></Pressable>
      : <View style={styles.brand}><Text style={styles.brandName}>SGEI</Text>{perfil ? <Text style={styles.role}>{roleLabel[perfil]}</Text> : null}</View>}
    {showAccount && perfil
      ? <Pressable accessibilityRole="button" accessibilityLabel="Minha conta" accessibilityHint="Abre o perfil e a opção de sair" hitSlop={6} onPress={() => router.push('/profile')} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{perfil.charAt(0)}</Text></View>
        <Text style={styles.accountText}>Conta</Text>
      </Pressable>
      : null}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  brand: { flexShrink: 1 },
  brandName: { color: palette.primary, fontSize: 15, fontWeight: '800' },
  role: { color: palette.muted, fontSize: 12, marginTop: 2 },
  back: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { color: palette.secondary, fontSize: 14, fontWeight: '700' },
  account: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: palette.line, borderRadius: 22, paddingLeft: 5, paddingRight: 13, backgroundColor: palette.surface },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.surface, fontSize: 14, fontWeight: '800' },
  accountText: { color: palette.primary, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
