import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/session';
import { Icon } from '@/components/icons';
import { palette, radius, roleLabel, space, type } from '@/constants/design';

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
      ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Icon name="arrowLeft" color={palette.ink} size={26} /><Text style={styles.backText}>Voltar</Text>
      </Pressable>
      : <View style={styles.brand}><Text style={styles.brandName}>SGEI</Text>{perfil ? <Text style={styles.role}>{roleLabel[perfil]}</Text> : null}</View>}
    {showAccount && perfil
      ? <Pressable accessibilityRole="button" accessibilityLabel="Minha conta" accessibilityHint="Abre o perfil e a opção de sair" hitSlop={4} onPress={() => router.push('/profile')} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
        <Icon name="user" color={palette.surface} size={20} />
      </Pressable>
      : null}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  brand: { flexShrink: 1 },
  brandName: { color: palette.primary, fontSize: 15, lineHeight: 18, fontWeight: '800', letterSpacing: 0.3 },
  role: { color: palette.muted, ...type.caption },
  // A seta é escura e grande (a mesma das conversas): em tons de apoio ela passava despercebida.
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: -space.sm, paddingRight: space.md },
  backText: { color: palette.ink, ...type.label },
  // 44 pt de área de toque; o disco visível é o próprio botão.
  account: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
