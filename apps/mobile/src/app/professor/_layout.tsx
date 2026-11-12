import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/auth/session';
import { canUseProfessor, homeForRole } from '@/auth/roles';
import { AppTabs, LoadingScreen, hiddenTab } from '@/components/app-tabs';
import { TabIcon } from '@/components/tab-icon';
import { palette } from '@/constants/design';
import { useMessagesDemo } from '@/demo/messages-store';

export default function ProfessorLayout() {
  const { state } = useSession();
  const { total } = useMessagesDemo();
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (!canUseProfessor(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  return <AppTabs>
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Mensagens', tabBarBadge: total ? total : undefined, tabBarBadgeStyle: { backgroundColor: palette.dangerStrong, color: palette.surface }, tabBarIcon: ({ color }) => <TabIcon name="message" color={color} /> }} />
    <Tabs.Screen name="classes" options={{ title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon name="grid" color={color} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Chamada', tabBarIcon: ({ color }) => <TabIcon name="check" color={color} /> }} />
    <Tabs.Screen name="grades" options={{ title: 'Notas', tabBarIcon: ({ color }) => <TabIcon name="doc" color={color} /> }} />
    <Tabs.Screen name="materials" options={hiddenTab} />
    <Tabs.Screen name="assignments" options={hiddenTab} />
    <Tabs.Screen name="class-detail" options={hiddenTab} />
  </AppTabs>;
}
