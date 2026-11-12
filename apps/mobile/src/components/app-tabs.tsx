import { Tabs } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/design';

const TAB_BAR_CONTENT_HEIGHT = 60;
const MIN_BOTTOM_PADDING = 8;

const InsideTabsContext = createContext(false);

/**
 * Opções para rotas das abas que não aparecem na barra (detalhes, listas secundárias).
 * `href: null` não serve aqui: o expo-router redireciona para a aba inicial quando uma rota
 * oculta recebe foco. Só `tabBarButton: () => null` deixa o espaço do item ocupado.
 */
export const hiddenTab = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } } as const;

/** Indica se a tela está dentro de uma barra de abas, que já reserva a área segura inferior. */
export function useInsideTabs() {
  return useContext(InsideTabsContext);
}

/**
 * Barra inferior única para Admin, Professor e Aluno. A altura soma a área segura do
 * aparelho (barra de gestos do Android, home indicator do iOS) em vez de usar valor fixo.
 */
export function AppTabs({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, MIN_BOTTOM_PADDING);
  return <InsideTabsContext.Provider value>
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: palette.primary,
      tabBarInactiveTintColor: palette.muted,
      tabBarHideOnKeyboard: Platform.OS === 'android',
      tabBarAllowFontScaling: false,
      tabBarStyle: { height: TAB_BAR_CONTENT_HEIGHT + bottom, paddingTop: 4, paddingBottom: bottom, paddingHorizontal: Math.max(insets.left, insets.right), backgroundColor: palette.surface, borderTopColor: palette.line },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    }}>
      {children}
    </Tabs>
  </InsideTabsContext.Provider>;
}

export function LoadingScreen() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={palette.primary} /></View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
