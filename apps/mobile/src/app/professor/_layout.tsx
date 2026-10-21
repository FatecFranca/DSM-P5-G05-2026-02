import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/auth/session';
import { canUseProfessor, homeForRole } from '@/auth/roles';
import { AppTabs, LoadingScreen, hiddenTab } from '@/components/app-tabs';
import { TabIcon } from '@/components/tab-icon';

export default function ProfessorLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (!canUseProfessor(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  return <AppTabs>
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} /> }} />
    <Tabs.Screen name="classes" options={{ title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon symbol="▦" color={color} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Chamada', tabBarIcon: ({ color }) => <TabIcon symbol="✓" color={color} /> }} />
    <Tabs.Screen name="grades" options={{ title: 'Notas', tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> }} />
    <Tabs.Screen name="materials" options={{ title: 'Materiais', tabBarIcon: ({ color }) => <TabIcon symbol="▣" color={color} /> }} />
    <Tabs.Screen name="assignments" options={hiddenTab} />
    <Tabs.Screen name="class-detail" options={hiddenTab} />
  </AppTabs>;
}
