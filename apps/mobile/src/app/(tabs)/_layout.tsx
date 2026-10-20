import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useSession } from '@/auth/session';
import { canUseAdmin, homeForRole } from '@/auth/roles';
import { palette } from '@/constants/design';
import { TabIcon } from '@/components/tab-icon';

export default function TabLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <ActivityIndicator color={palette.primary} />;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (!canUseAdmin(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  const canSeeMetrics = ['ADMIN', 'COORDENACAO'].includes(state.user.perfil);
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.primary, tabBarInactiveTintColor: palette.muted, tabBarStyle: { height: 62, paddingTop: 10, paddingBottom: 8, backgroundColor: palette.surface, borderTopColor: palette.line }, tabBarLabelStyle: { fontSize: 12, fontWeight: '700' } }}>
    <Tabs.Screen name="dashboard" options={{ title: 'Painel', tabBarAccessibilityLabel: 'Painel acadêmico', tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} /> }} />
    <Tabs.Screen name="students" options={{ title: 'Estudantes', tabBarIcon: ({ color }) => <TabIcon symbol="▧" color={color} /> }} />
    <Tabs.Screen name="classes" options={{ title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon symbol="▦" color={color} /> }} />
    <Tabs.Screen name="simulations" options={{ title: 'Cenários', tabBarIcon: ({ color }) => <TabIcon symbol="◇" color={color} /> }} />
    <Tabs.Screen name="metrics" options={{ title: 'Modelo', href: canSeeMetrics ? undefined : null, tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> }} />
  </Tabs>;
}
