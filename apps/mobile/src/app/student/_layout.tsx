import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useSession } from '@/auth/session';
import { homeForRole } from '@/auth/roles';
import { palette } from '@/constants/design';
import { TabIcon } from '@/components/tab-icon';

export default function StudentLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <ActivityIndicator color={palette.primary} />;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (state.user.perfil !== 'ALUNO') return <Redirect href={homeForRole(state.user.perfil)} />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.primary, tabBarInactiveTintColor: palette.muted, tabBarStyle: { height: 62, paddingTop: 10, paddingBottom: 8, backgroundColor: palette.surface, borderTopColor: palette.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} /> }} />
    <Tabs.Screen name="grades" options={{ title: 'Notas', tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Faltas', tabBarIcon: ({ color }) => <TabIcon symbol="✓" color={color} /> }} />
    <Tabs.Screen name="assignments" options={{ title: 'Atividades', tabBarIcon: ({ color }) => <TabIcon symbol="□" color={color} /> }} />
    <Tabs.Screen name="materials" options={{ title: 'Materiais', tabBarIcon: ({ color }) => <TabIcon symbol="▣" color={color} /> }} />
    <Tabs.Screen name="courses" options={{ tabBarButton: () => null }} />
    <Tabs.Screen name="course-detail" options={{ tabBarButton: () => null }} />
    <Tabs.Screen name="calendar" options={{ tabBarButton: () => null }} />
    <Tabs.Screen name="notifications" options={{ tabBarButton: () => null }} />
    <Tabs.Screen name="assignment-detail" options={{ tabBarButton: () => null }} />
  </Tabs>;
}
