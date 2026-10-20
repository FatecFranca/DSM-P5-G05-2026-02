import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useSession } from '@/auth/session';
import { canUseProfessor, homeForRole } from '@/auth/roles';
import { palette } from '@/constants/design';
import { TabIcon } from '@/components/tab-icon';

export default function ProfessorLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <ActivityIndicator color={palette.primary} />;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (!canUseProfessor(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.primary, tabBarInactiveTintColor: palette.muted, tabBarStyle: { height: 62, paddingTop: 10, paddingBottom: 8, backgroundColor: palette.surface, borderTopColor: palette.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} /> }} />
    <Tabs.Screen name="classes" options={{ title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon symbol="▦" color={color} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Chamada', tabBarIcon: ({ color }) => <TabIcon symbol="✓" color={color} /> }} />
    <Tabs.Screen name="grades" options={{ title: 'Notas', tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> }} />
    <Tabs.Screen name="materials" options={{ title: 'Materiais', tabBarIcon: ({ color }) => <TabIcon symbol="▣" color={color} /> }} />
    <Tabs.Screen name="assignments" options={{ tabBarButton: () => null }} />
    <Tabs.Screen name="class-detail" options={{ tabBarButton: () => null }} />
  </Tabs>;
}
